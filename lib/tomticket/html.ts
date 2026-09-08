// O corpo do chamado no TomTicket às vezes vem como TEXTO e às vezes como
// HTML — depende de o solicitante ter usado o editor rico da tela deles. Sem
// tratar, o técnico via literalmente `<p fr-original-style="">teste_02</p>`
// (caso real, chamado #331166).
//
// Não é um parser de HTML e não precisa ser: o conteúdo é sempre um corpo de
// mensagem simples (parágrafo, quebra de linha, no máximo negrito).

const ENTIDADES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

// Só mexe se PARECER html. Sem isso, um texto legítimo com "<" (ex.: "pressão
// < 2 bar") seria mutilado pela remoção de tags.
function pareceHtml(texto: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(texto);
}

export function textoDeHtml(bruto: string): string {
  if (!bruto || !pareceHtml(bruto)) return bruto;

  let texto = bruto
    // Bloco e quebra viram quebra de linha ANTES de as tags sumirem.
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    // Script/style não são conteúdo: some com o miolo, não só com a tag.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "");

  for (const [entidade, valor] of Object.entries(ENTIDADES)) {
    texto = texto.split(entidade).join(valor);
  }
  texto = texto.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

  return texto
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    // 3+ quebras seguidas viram 2: o HTML costuma gerar parágrafo vazio.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
