import { StatusDot } from "@/lib/ui/status-dot";

// "concluida" nunca é gravado em `urgencias.status` (ver migration 0027) —
// é derivado na leitura a partir do status do `servico` vinculado
// (concluido_tecnico/aguardando_validacao/validado). Ainda assim faz parte
// do vocabulário visual da tela, por isso entra aqui.
export type UrgenciaStatus =
  | "solicitada"
  | "em_analise"
  | "validada"
  | "nao_validada"
  | "em_atendimento"
  | "concluida"
  | "cancelada";

const CONFIG: Record<UrgenciaStatus, { label: string; dotClass: string; textClass: string }> = {
  solicitada: { label: "Solicitada", dotClass: "bg-text-tertiary", textClass: "text-text-secondary" },
  em_analise: { label: "Em análise", dotClass: "bg-priority-alta", textClass: "text-text-secondary" },
  validada: { label: "Validada", dotClass: "bg-accent", textClass: "text-accent" },
  nao_validada: {
    label: "Não validada",
    dotClass: "border border-text-tertiary",
    textClass: "text-text-tertiary",
  },
  em_atendimento: {
    label: "Em atendimento",
    dotClass: "bg-priority-alta",
    textClass: "font-semibold text-priority-alta",
  },
  concluida: { label: "Concluída", dotClass: "bg-sla-dentro", textClass: "text-sla-dentro" },
  cancelada: { label: "Cancelada", dotClass: "border border-text-tertiary", textClass: "text-text-tertiary" },
};

export function UrgenciaStatusBadge({ status }: { status: UrgenciaStatus }) {
  const c = CONFIG[status];
  return <StatusDot label={c.label} dotClassName={c.dotClass} textClassName={c.textClass} />;
}
