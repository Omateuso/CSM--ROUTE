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
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${resolvido ? "text-text-tertiary" : "text-text-secondary"}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${resolvido ? "border border-text-tertiary" : "bg-text-tertiary"}`}
        aria-hidden="true"
      />
      {LABELS[status]}
    </span>
  );
}
