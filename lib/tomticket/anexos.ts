import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ErroTomTicket, type AnexoParaEnvio } from "./client";
import { TOMTICKET_MAX_ANEXOS, TOMTICKET_MAX_REQUISICAO_BYTES } from "./config";

// Monta os anexos da resposta a partir do bucket privado `evidencias`.
//
// Regra definida pelo usuário: se couber no limite, vai o ARQUIVO ORIGINAL,
// sem tocar em nada — a foto carimbada e a OS são documentação do atendimento,
// e recomprimir por precaução degradaria evidência à toa. Só quando estoura é
// que comprimimos, e só as imagens.

export type EvidenciaParaAnexo = {
  storagePath: string;
  tipo: "foto" | "os" | "documento";
  momento: "antes" | "depois" | "parcial" | null;
};

// Margem pro overhead do multipart (boundaries e cabeçalho de cada parte) e
// pro corpo da mensagem. O teto de 25 MB vale pra requisição inteira, não por
// arquivo — encostar nele exatamente seria pedir um 4xx na cara do gerente.
const MARGEM_BYTES = 512 * 1024;
const ORCAMENTO_BYTES = TOMTICKET_MAX_REQUISICAO_BYTES - MARGEM_BYTES;

// Fotos já saem do celular redimensionadas pra 1920px (camera-capture-field),
// então na prática este caminho quase nunca roda. Ele existe pro caso de uma
// OS fotografada em resolução cheia.
const PASSOS_COMPRESSAO = [
  { largura: 1920, qualidade: 80 },
  { largura: 1600, qualidade: 70 },
  { largura: 1280, qualidade: 60 },
  { largura: 1024, qualidade: 50 },
];

function nomeAmigavel(evidencia: EvidenciaParaAnexo, mime: string): string {
  const extensao = mime.includes("pdf") ? "pdf" : mime.includes("png") ? "png" : "jpg";

  if (evidencia.tipo === "os") return `ordem-de-servico.${extensao}`;
  if (evidencia.tipo === "documento") return `documento.${extensao}`;
  if (evidencia.momento) return `foto-${evidencia.momento}.${extensao}`;
  return `foto.${extensao}`;
}

function ehImagem(mime: string): boolean {
  return mime.startsWith("image/");
}

function somaBytes(anexos: AnexoParaEnvio[]): number {
  return anexos.reduce((total, a) => total + a.conteudo.byteLength, 0);
}

function formatarMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function montarAnexos(
  supabase: SupabaseClient,
  evidencias: EvidenciaParaAnexo[],
): Promise<AnexoParaEnvio[]> {
  if (evidencias.length > TOMTICKET_MAX_ANEXOS) {
    throw new ErroTomTicket(
      `O TomTicket aceita no máximo ${TOMTICKET_MAX_ANEXOS} anexos por resposta, e esse serviço tem ${evidencias.length}.`,
    );
  }

  const originais: AnexoParaEnvio[] = [];

  for (const evidencia of evidencias) {
    const { data, error } = await supabase.storage.from("evidencias").download(evidencia.storagePath);
    if (error || !data) {
      throw new ErroTomTicket(
        `Não consegui baixar um anexo do serviço (${evidencia.tipo}). Tente de novo em alguns instantes.`,
      );
    }

    const mime = data.type || "application/octet-stream";
    originais.push({
      nome: nomeAmigavel(evidencia, mime),
      mime,
      conteudo: new Uint8Array(await data.arrayBuffer()),
    });
  }

  if (somaBytes(originais) <= ORCAMENTO_BYTES) return originais;

  // Estourou: comprime só as imagens, progressivamente. PDF nunca é alterado —
  // é documento assinado, e reescrever isso mudaria o que o cliente recebe.
  for (const passo of PASSOS_COMPRESSAO) {
    const tentativa: AnexoParaEnvio[] = [];

    for (const anexo of originais) {
      if (!ehImagem(anexo.mime)) {
        tentativa.push(anexo);
        continue;
      }
      const comprimido = await sharp(anexo.conteudo)
        .rotate()
        .resize({ width: passo.largura, height: passo.largura, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: passo.qualidade })
        .toBuffer();

      tentativa.push({
        nome: anexo.nome.replace(/\.(png|jpe?g|webp|heic)$/i, ".jpg"),
        mime: "image/jpeg",
        conteudo: new Uint8Array(comprimido),
      });
    }

    if (somaBytes(tentativa) <= ORCAMENTO_BYTES) return tentativa;
  }

  // Só chega aqui se o que estoura não é imagem (ex.: OS em PDF de 20 MB).
  // Nomear o arquivo problemático importa: sem isso o gerente recebe "não deu"
  // e não tem o que fazer com essa informação.
  const naoComprimiveis = originais.filter((a) => !ehImagem(a.mime));
  const maiores = naoComprimiveis
    .sort((a, b) => b.conteudo.byteLength - a.conteudo.byteLength)
    .map((a) => `${a.nome} (${formatarMb(a.conteudo.byteLength)})`)
    .join(", ");

  throw new ErroTomTicket(
    `Os anexos passam do limite de ${formatarMb(TOMTICKET_MAX_REQUISICAO_BYTES)} do TomTicket mesmo depois de comprimir as imagens.` +
      (maiores ? ` O que não dá pra comprimir: ${maiores}.` : "") +
      " Anexe esse arquivo manualmente no TomTicket.",
  );
}
