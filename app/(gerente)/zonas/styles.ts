// Anel de foco compartilhado — mesmo tratamento visual em todo botão/link
// de texto da tela, consistente com o anel accent já usado nos inputs.
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface rounded-[var(--radius-sm)]";

// py-1.5 sobre text-xs (16px de linha) dá ~28px de altura de alvo de
// toque — acima do mínimo de 24px do WCAG 2.2 AA (2.5.8) pros botões de
// ação que são só texto (Renomear/Excluir/Cancelar).
export const TAP_TARGET = "py-1.5 -my-1.5";
