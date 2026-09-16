import sharp from "sharp";
import type { SupabaseServerClient } from "@/lib/relatorio/types";
import { CORES } from "./csm";

// ~292 serviços × até 3 imagens ≈ 900 imagens num documento. O `docx` embute o
// buffer que você entrega, sem redução — então redimensionar antes é
// requisito, não otimização (seção 4 do prompt).
//
// `fit: "contain"` (15/09/2026, substitui "cover"): sem padrão de como o
// técnico fotografa (retrato, paisagem, de perto, de longe...), recortar pra
// preencher o quadro cortava conteúdo de verdade — a foto da OS assinada
// aparecia com metade dos campos fora do enquadramento. `contain` encolhe a
// imagem inteira pra caber dentro do quadro, sem cortar nada, preenchendo a
// sobra com um fundo neutro (mesmo cinza claro do quadro vazio) em vez de
// deixar transparência.

export type ImagemQuadro = { data: Buffer; largura: number; altura: number; tipo: "jpg" | "png" };

const QUALIDADE_JPEG = 72;

function hexParaRgb(hex: string): { r: number; g: number; b: number } {
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
}

const FUNDO_QUADRO = { ...hexParaRgb(CORES.quadroFundo), alpha: 1 };

/** Baixa um arquivo de um bucket privado do Storage — usado por qualquer módulo de relatório. */
export async function baixarDoStorage(
  supabase: SupabaseServerClient,
  bucket: string,
  storagePath: string,
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Ajusta um buffer já em mãos pra caber inteiro dentro do quadro (sem
 * cortar), preenchendo a sobra com o fundo neutro. Bucket-agnóstico — quem
 * chama já baixou o arquivo de onde for (`baixarDoStorage` ou outro).
 * Devolve `null` quando o buffer não é imagem rasterizável (ex.: PDF) ou
 * está corrompido — quem chama desenha um quadro de fallback no lugar.
 */
export async function bufferParaQuadro(
  entrada: Buffer,
  quadro: { largura: number; altura: number },
): Promise<ImagemQuadro | null> {
  try {
    const data = await sharp(entrada)
      .rotate() // aplica a orientação do EXIF antes de redimensionar
      .resize(quadro.largura, quadro.altura, { fit: "contain", background: FUNDO_QUADRO })
      .flatten({ background: FUNDO_QUADRO }) // funde eventual alpha do PNG de origem no fundo, não em preto
      .jpeg({ quality: QUALIDADE_JPEG })
      .toBuffer();
    return { data, largura: quadro.largura, altura: quadro.altura, tipo: "jpg" };
  } catch {
    return null;
  }
}

/** Baixa a evidência (bucket `evidencias`) e ajusta pra caber no quadro — ver `bufferParaQuadro`. */
export async function evidenciaParaQuadro(
  supabase: SupabaseServerClient,
  storagePath: string | null,
  quadro: { largura: number; altura: number },
): Promise<ImagemQuadro | null> {
  if (!storagePath) return null;
  const entrada = await baixarDoStorage(supabase, "evidencias", storagePath);
  if (!entrada) return null;
  return bufferParaQuadro(entrada, quadro);
}

/** Foto decorativa da capa: recorta em círculo (P&B), como no canvas de design. */
export async function fotoCapaCircular(entrada: Buffer, diametro: number): Promise<ImagemQuadro | null> {
  const mascara = Buffer.from(
    `<svg width="${diametro}" height="${diametro}"><circle cx="${diametro / 2}" cy="${diametro / 2}" r="${
      diametro / 2
    }" fill="#fff"/></svg>`,
  );
  try {
    const data = await sharp(entrada)
      .rotate()
      .resize(diametro, diametro, { fit: "cover", position: "centre" })
      .greyscale()
      .composite([{ input: mascara, blend: "dest-in" }])
      .png()
      .toBuffer();
    return { data, largura: diametro, altura: diametro, tipo: "png" };
  } catch {
    return null;
  }
}

export async function logoDimensionado(
  entrada: Buffer,
  larguraAlvo: number,
): Promise<{ data: Buffer; largura: number; altura: number; tipo: "png" }> {
  const meta = await sharp(entrada).metadata();
  const proporcao = meta.height && meta.width ? meta.height / meta.width : 0.5;
  const altura = Math.round(larguraAlvo * proporcao);
  const data = await sharp(entrada).resize(larguraAlvo, altura, { fit: "inside" }).png().toBuffer();
  return { data, largura: larguraAlvo, altura, tipo: "png" };
}

/** map com limite de concorrência — evita 900 downloads simultâneos do Storage. */
export async function mapComLimite<T, R>(
  itens: T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const resultados = new Array<R>(itens.length);
  let proximo = 0;
  async function worker() {
    while (proximo < itens.length) {
      const meu = proximo++;
      resultados[meu] = await fn(itens[meu], meu);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limite, itens.length)) }, worker));
  return resultados;
}
