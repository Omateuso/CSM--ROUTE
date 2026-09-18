// Classes compartilhadas da identidade visual "Azulejo" (18/09/2026).
// Medidas e decisões em .interface-design/system.md. Toda tela deve
// importar daqui em vez de repetir a string de utilitários — o segundo uso
// de uma combinação nova vira uma constante aqui, não um copiar-e-colar.

// Anel de foco compartilhado — mesmo tratamento visual em todo botão/link
// de texto do sistema, consistente com o anel accent já usado nos inputs.
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-[var(--radius-sm)]";

// py-1.5 sobre text-xs (16px de linha) dá ~28px de altura de alvo de
// toque — acima do mínimo de 24px do WCAG 2.2 AA (2.5.8) pros botões de
// ação que são só texto (Renomear/Excluir/Cancelar).
export const TAP_TARGET = "py-1.5 -my-1.5";

// Base de todo botão "de verdade" (com fundo/borda): altura 36px, raio
// pequeno, feedback de pressão (`active:scale-[.97]`), transição curta
// só em transform/cor (nunca `transition-all`).
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 h-9 px-3.5 rounded-[var(--radius-sm)] text-[13.5px] font-semibold whitespace-nowrap transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Ação principal da tela (1 por contexto): teal sólido, texto branco. */
export const PRIMARY_BUTTON = `${BUTTON_BASE} bg-accent text-on-accent hover:bg-accent-hover`;

/** Ação secundária: superfície branca com borda; convive ao lado da primária. */
export const SECONDARY_BUTTON = `${BUTTON_BASE} bg-surface text-text-primary border border-border-strong hover:bg-surface-input`;

/** Ação destrutiva (excluir, cancelar rota). */
export const DANGER_BUTTON = `${BUTTON_BASE} bg-danger text-on-accent hover:bg-danger-hover`;

/** Ação terciária sem moldura (Editar, Ver detalhes) — texto no destaque. */
export const GHOST_BUTTON = `${BUTTON_BASE} bg-transparent text-accent hover:bg-accent-tint`;

/** Botão só de ícone (fechar, menu): quadrado 36px, alvo de toque ok. */
export const ICON_BUTTON = `${BUTTON_BASE} w-9 px-0 bg-transparent text-text-tertiary hover:bg-surface-hover hover:text-text-primary`;

// Botão de ação primária do app do técnico — Iniciar/Concluir atendimento
// (pedido do usuário, 15/09/2026: "deve ficar totalmente verde com letras
// brancas... padronize os estilos"). `--success` (verde genérico de feedback
// positivo), não `--sla-dentro` (reservado a SLA/status). Mais alto (52px)
// e maior que os demais porque é apertado com o polegar, em pé, na rua.
export const PRIMARY_ACTION_BUTTON =
  "inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-success px-4 py-3.5 text-base font-semibold text-on-accent transition-[transform,background-color] duration-150 ease-out hover:bg-success-hover active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent";

/** Secundário do app do técnico (Abrir no Google Maps, Voltar): mesma altura, moldura. */
export const SECONDARY_ACTION_BUTTON =
  "inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-4 py-3 text-[15px] font-semibold text-text-primary transition-[transform,background-color] duration-150 ease-out hover:bg-surface-input active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent";

// Campo de formulário padrão dentro de diálogos/inline forms. Fundo um
// pouco mais escuro que a superfície (campo é "rebaixado", recebe
// conteúdo), borda visível, foco = borda + anel do destaque.
export const FIELD_INPUT =
  "w-full rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:ring-2 focus:ring-accent/25";
export const FIELD_LABEL = "text-xs font-medium text-text-secondary";

/** Card padrão: superfície branca, raio médio, elevação por sombra (não borda). */
export const CARD = "rounded-[var(--radius-md)] bg-surface shadow-lift";

/** Card clicável: mesma base + sobe levemente no hover. */
export const CARD_INTERACTIVE = `${CARD} transition-shadow duration-150 ease-out hover:shadow-lift-hover`;

/** Título de seção dentro da página ("Operação de hoje"). */
export const SECTION_TITLE = "text-[15px] font-semibold text-text-primary";

// Placa da RT — assinatura visual do produto: o código permanente da casa
// (`SRT 14`) em mono, com moldura, como a placa de número na fachada. O
// endereço muda com o tempo, a placa não (ver CLAUDE.md, "Endereço de RT
// tem histórico"). Usar SEMPRE que um código de RT aparecer na UI.
export const PLACA_RT =
  "inline-flex h-[22px] items-center whitespace-nowrap rounded-[5px] border border-border-strong bg-surface-input px-1.5 font-mono text-[11.5px] font-semibold tracking-[0.04em] text-text-primary tabular-nums";
