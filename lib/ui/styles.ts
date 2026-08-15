// Anel de foco compartilhado — mesmo tratamento visual em todo botão/link
// de texto do sistema, consistente com o anel accent já usado nos inputs.
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface rounded-[var(--radius-sm)]";

// py-1.5 sobre text-xs (16px de linha) dá ~28px de altura de alvo de
// toque — acima do mínimo de 24px do WCAG 2.2 AA (2.5.8) pros botões de
// ação que são só texto (Renomear/Excluir/Cancelar).
export const TAP_TARGET = "py-1.5 -my-1.5";

// Campo de formulário padrão dentro de diálogos/inline forms.
export const FIELD_INPUT =
  "w-full rounded-[var(--radius-sm)] border border-border bg-surface-input px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent";
export const FIELD_LABEL = "text-xs font-medium text-text-secondary";
