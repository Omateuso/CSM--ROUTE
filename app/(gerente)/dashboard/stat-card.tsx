type Tom = "neutro" | "emergencial" | "vencido";

const TOM_VALOR: Record<Tom, string> = {
  neutro: "text-text-primary",
  emergencial: "text-priority-emergencial",
  vencido: "text-sla-vencido",
};

export function StatCard({
  label,
  value,
  tom = "neutro",
}: {
  label: string;
  value: number;
  tom?: Tom;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
      <p className="text-xs font-medium text-text-tertiary">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${TOM_VALOR[tom]}`}>{value}</p>
    </div>
  );
}
