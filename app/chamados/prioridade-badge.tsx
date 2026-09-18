import { StatusDot } from "@/lib/ui/status-dot";

export type Prioridade = "emergencial" | "alta" | "normal" | "baixa";

// Cores da tabela em CLAUDE.md ("Sistema de cores"). "baixa" não está na
// tabela original — decidido com o usuário ao implementar B3: fica neutra
// (sem dot preenchido), preservando as outras cores pros significados já
// definidos. Emergencial ganha texto em negrito/colorido além do dot: é o
// nível que precisa "se destacar visualmente" mesmo sozinho na tabela.
// Pílula com fundo tingido (nova identidade visual, 18/09/2026): texto na
// cor escura da escala, fundo na versão `-tint` — passa AA e continua
// legível quando há várias na mesma linha.
const CONFIG: Record<
  Prioridade,
  { label: string; dotClass: string; textClass: string; pillClass: string }
> = {
  emergencial: {
    label: "Emergencial",
    dotClass: "bg-priority-emergencial",
    textClass: "font-semibold text-priority-emergencial",
    pillClass: "bg-priority-emergencial-tint",
  },
  alta: {
    label: "Alta",
    dotClass: "bg-priority-alta",
    textClass: "text-priority-alta",
    pillClass: "bg-priority-alta-tint",
  },
  normal: {
    label: "Normal",
    dotClass: "bg-priority-normal",
    textClass: "text-priority-normal",
    pillClass: "bg-priority-normal-tint",
  },
  baixa: {
    label: "Baixa",
    dotClass: "bg-text-tertiary",
    textClass: "text-text-secondary",
    pillClass: "bg-surface-input",
  },
};

export const PRIORIDADE_OPTIONS: { value: Prioridade; label: string }[] = (
  Object.keys(CONFIG) as Prioridade[]
).map((value) => ({ value, label: CONFIG[value].label }));

export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  const c = CONFIG[prioridade];
  return (
    <StatusDot
      label={c.label}
      dotClassName={c.dotClass}
      textClassName={c.textClass}
      pillClassName={c.pillClass}
    />
  );
}
