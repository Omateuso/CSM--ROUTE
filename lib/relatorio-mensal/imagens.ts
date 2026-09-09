import sharp from "sharp";
import type { SupabaseServerClient } from "@/lib/relatorio/types";

// ~292 serviços × até 3 imagens ≈ 900 imagens num documento. O `docx` embute o
// buffer que você entrega, sem redução — então redimensionar antes é
// requisito, não otimização (seção 4 do prompt). `fit: "cover"` deixa toda
// imagem EXATAMENTE do tamanho do quadro → páginas de serviço uniformes,
// independente de a foto ter vindo deitada ou em pé.

export type ImagemQuadro = { data: Buffer; largura: number; altura: number; tipo: "jpg" | "png" };

const QUALIDADE_JPEG = 72;

export async function baixarDoStorage(
  supabase: SupabaseServerClient,
  storagePath: string,
): Promise<Buffer | null> {
  const { data, error } = await supabase.storage.from("evidencias").download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Baixa a evidência e ajusta pra preencher o quadro (cover). Devolve `null`
 * quando o arquivo não é imagem rasterizável (ex.: OS anexada em PDF) ou está
 * corrompido — quem chama desenha um quadro de fallback no lugar.
 */
export async function evidenciaParaQuadro(
  supabase: SupabaseServerClient,
  storagePath: string | null,
  quadro: { largura: number; altura: number },
): Promise<ImagemQuadro | null> {
  if (!storagePath) return null;
  const entrada = await baixarDoStorage(supabase, storagePath);
  if (!entrada) return null;
  try {
    const data = await sharp(entrada)
      .rotate() // aplica a orientação do EXIF antes de redimensionar
      .resize(quadro.largura, quadro.altura, { fit: "cover", position: "centre" })
      .jpeg({ quality: QUALIDADE_JPEG })
      .toBuffer();
    return { data, largura: quadro.largura, altura: quadro.altura, tipo: "jpg" };
  } catch {
    return null;
  }
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
