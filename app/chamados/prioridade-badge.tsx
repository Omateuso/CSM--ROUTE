export type Prioridade = "emergencial" | "alta" | "normal" | "baixa";

// Cores da tabela em CLAUDE.md ("Sistema de cores"). "baixa" não está na
// tabela original — decidido com o usuário ao implementar B3: fica neutra
// (sem dot preenchido), preservando as outras cores pros significados já
// definidos. Emergencial ganha texto em negrito/colorido além do dot: é o
// nível que precisa "se destacar visualmente" mesmo sozinho na tabela.
const CONFIG: Record<Prioridade, { label: string; dotClass: string; textClass: string }> = {
  emergencial: {
    label: "Emergencial",
    dotClass: "bg-priority-emergencial",
    textClass: "font-semibold text-priority-emergencial",
  },
  alta: {
    label: "Alta",
    dotClass: "bg-priority-alta",
    textClass: "text-text-secondary",
  },
  normal: {
    label: "Normal",
    dotClass: "bg-priority-normal",
    textClass: "text-text-secondary",
  },
  baixa: {
    label: "Baixa",
    dotClass: "border border-text-tertiary",
    textClass: "text-text-tertiary",
  },
};

export const PRIORIDADE_OPTIONS: { value: Prioridade; label: string }[] = (
  Object.keys(CONFIG) as Prioridade[]
).map((value) => ({ value, label: CONFIG[value].label }));

export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  const c = CONFIG[prioridade];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${c.textClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dotClass}`} aria-hidden="true" />
      {c.label}
    </span>
  );
}
