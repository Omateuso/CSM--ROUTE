import { StatusDot } from "@/lib/ui/status-dot";

export type StatusChamado = "aberto" | "em_andamento" | "finalizado" | "cancelado";

export const STATUS_OPTIONS: { value: StatusChamado; label: string }[] = [
  { value: "aberto", label: "Aberto" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "finalizado", label: "Finalizado" },
  { value: "cancelado", label: "Cancelado" },
];

const LABELS: Record<StatusChamado, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

// Sem cor operacional aqui de propósito — o sistema de cores do CLAUDE.md
// é reservado pra prioridade/SLA. Status do chamado usa o mesmo padrão
// neutro do StatusBadge de RTs (dot cheio = ativo/em curso, contorno =
// encerrado).
export function StatusChamadoBadge({ status }: { status: StatusChamado }) {
  const resolvido = status === "finalizado" || status === "cancelado";
  return (
    <StatusDot
      label={LABELS[status]}
      dotClassName={resolvido ? "border border-text-tertiary" : "bg-text-tertiary"}
      textClassName={resolvido ? "text-text-tertiary" : "text-text-secondary"}
    />
  );
}
