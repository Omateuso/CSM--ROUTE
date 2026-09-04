import { computeSlaStatus } from "@/lib/sla";
import { StatusDot } from "@/lib/ui/status-dot";

type StatusChamado = "aberto" | "em_andamento" | "finalizado" | "cancelado";

const CONFIG = {
  dentro: { label: "Dentro do SLA", dotClass: "bg-sla-dentro", textClass: "text-text-secondary" },
  proximo: {
    label: "Próximo do vencimento",
    dotClass: "bg-sla-proximo",
    textClass: "text-text-secondary",
  },
  vencido: {
    label: "SLA vencido",
    dotClass: "bg-sla-vencido",
    textClass: "font-semibold text-sla-vencido",
  },
};

export function SlaBadge({
  slaPrazo,
  status,
}: {
  slaPrazo: string | null;
  status: StatusChamado;
}) {
  // Chamado já resolvido: o prazo não é mais uma urgência ativa, mostrar
  // "vencido"/"próximo" aqui confundiria mais do que ajudaria.
  if (status === "finalizado" || status === "cancelado") {
    return (
      <span className="text-xs text-text-tertiary" aria-label="SLA não aplicável — chamado encerrado">
        —
      </span>
    );
  }

  const c = CONFIG[computeSlaStatus(slaPrazo)];
  return <StatusDot label={c.label} dotClassName={c.dotClass} textClassName={c.textClass} />;
}
