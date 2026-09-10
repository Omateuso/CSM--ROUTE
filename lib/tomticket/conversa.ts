// Reconhecer se uma mensagem já está na conversa de um chamado no TomTicket — a
// trava anti-duplicata primária (a API não tem "desenviar", e isso escreve no
// chamado que a iGEDES lê). Comparar texto cru daria falso negativo por causa
// de uma tag de formatação; normaliza dos dois lados. Mesma ideia do
// `conversa_contem` da base-automatizacao; portado de tomticket-actions.ts
// (08/09/2026) e compartilhado com o compositor da tela de Chamados.

export function normalizarConversa(texto: string): string {
  return texto
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// A "impressão digital" da mensagem: o suficiente pra reconhecê-la na conversa
// sem depender de formatação.
export function assinaturaDaMensagem(mensagem: string): string {
  return normalizarConversa(mensagem).slice(0, 80);
}

export function jaEstaNaConversa(
  replies: { message: string; senderType: string }[],
  mensagem: string,
): boolean {
  const alvo = assinaturaDaMensagem(mensagem);
  if (!alvo) return false;
  return replies.some(
    (r) => r.senderType.toUpperCase() === "A" && normalizarConversa(r.message).includes(alvo),
  );
}
