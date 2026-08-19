import { computeSlaStatus } from "@/lib/sla";

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
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${c.textClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dotClass}`} aria-hidden="true" />
      {c.label}
    </span>
  );
}
