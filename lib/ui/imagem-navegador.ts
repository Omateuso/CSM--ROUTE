// Decodificação/redimensionamento de imagem inteiramente no navegador, sem
// nunca decodificar em resolução nativa — extraído de
// app/(tecnico)/servico/[id]/camera-capture-field.tsx (15/09/2026) pra ser
// reaproveitado também pelo campo de OS (os-attach-field.tsx), que subia
// a foto sem NENHUMA compressão. Achado real (usuário, 15/09/2026): mesmo
// depois de corrigir a foto principal, o "insuficiência de memória"
// continuou aparecendo ao CONCLUIR — a causa provável é a OS, que também
// pode vir de câmera (`capture="environment"`) mas nunca passava por
// nenhum redimensionamento; combinada com a foto principal + áudio (0051)
// na mesma requisição, o corpo total (e a memória de montar esse corpo no
// navegador) ainda podia estourar num celular fraco.
//
// `createImageBitmap` com `resizeWidth`/`resizeHeight` deixa o PRÓPRIO
// decodificador do navegador já produzir a imagem no tamanho final
// (equivalente ao `inSampleSize` do Android) — o pico de memória nunca
// passa pelo tamanho nativo. A spec NÃO preserva a proporção quando os
// dois lados são dados ao mesmo tempo, então o primeiro passe (barato: o
// decodificador já subamostra pro tamanho pedido) usa só `resizeWidth` —
// serve também pra descobrir a proporção real (já com a orientação EXIF
// aplicada via `imageOrientation: "from-image"`). Se já cabe nos dois
// lados (paisagem/quadrada), 1 decodificação só; retrato precisa de um
// segundo passe com os dois lados certos, mas mesmo esse nunca decodifica
// em resolução nativa.
export async function decodificarRedimensionada(file: File, maxDimensaoPx: number): Promise<ImageBitmap> {
  const opcoesBase = { imageOrientation: "from-image" as const, resizeQuality: "medium" as const };
  const passe1 = await createImageBitmap(file, { ...opcoesBase, resizeWidth: maxDimensaoPx });
  if (passe1.height <= maxDimensaoPx) return passe1;

  const alvoLargura = Math.round(maxDimensaoPx * (passe1.width / passe1.height));
  passe1.close();
  return createImageBitmap(file, { ...opcoesBase, resizeWidth: alvoLargura, resizeHeight: maxDimensaoPx });
}

/** Fallback pra navegadores sem suporte às opções de resize do
 * `createImageBitmap` (Safari mais antigo, principalmente) — decodifica em
 * resolução nativa antes de reduzir, mesmo caminho que o projeto inteiro
 * usava antes desta correção. */
export function carregarComoImagem(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

/**
 * Redimensiona e recomprime uma imagem pro máximo de `maxDimensaoPx` no
 * lado maior — sem carimbo, sem geolocalização (isso é específico de
 * `camera-capture-field.tsx`; aqui é só "não subir um arquivo gigante cru").
 * Best-effort: qualquer falha (formato exótico, canvas indisponível) faz
 * cair pro `file` original em vez de travar o envio — comprimir é reforço,
 * nunca um portão que pode barrar o técnico de anexar a OS.
 */
export async function comprimirImagem(file: File, maxDimensaoPx = 2560, qualidade = 0.85): Promise<File> {
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap =
      typeof createImageBitmap === "function"
        ? await decodificarRedimensionada(file, maxDimensaoPx)
        : await carregarComoImagem(file);
  } catch {
    try {
      bitmap = await carregarComoImagem(file);
    } catch {
      return file;
    }
  }

  const largura = "naturalWidth" in bitmap ? bitmap.naturalWidth : bitmap.width;
  const altura = "naturalHeight" in bitmap ? bitmap.naturalHeight : bitmap.height;
  const escala = Math.min(1, maxDimensaoPx / Math.max(largura, altura));
  const canvasLargura = Math.round(largura * escala);
  const canvasAltura = Math.round(altura * escala);

  const canvas = document.createElement("canvas");
  canvas.width = canvasLargura;
  canvas.height = canvasAltura;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if ("close" in bitmap) bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvasLargura, canvasAltura);
  if ("close" in bitmap) bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
  if (!blob) return file;

  const nomeBase = file.name.replace(/\.\w+$/, "") || "arquivo";
  return new File([blob], `${nomeBase}.jpg`, { type: "image/jpeg" });
}
