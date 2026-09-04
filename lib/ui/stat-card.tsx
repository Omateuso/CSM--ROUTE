// Movido de app/(gerente)/dashboard/ pra lib/ui/ (auditoria de design,
// 23/08/2026) — a Gestão já importava daqui cross-pasta, sinal de que o
// componente sempre foi compartilhado, só morava no lugar errado.
//
// `enfase` é a mudança de verdade: antes todo StatCard usava `text-3xl`
// sem distinção — a métrica "que importa agora" tinha o mesmo peso visual
// que qualquer contagem de contexto. `hero` (1 por tela, no máximo) fica
// bem maior que `padrao`; nunca os dois nomes de escala mais próximos
// (3xl/4xl) coexistem — só há um degrau visível.
type Tom = "neutro" | "emergencial" | "vencido";
type Enfase = "hero" | "padrao";

const TOM_VALOR: Record<Tom, string> = {
  neutro: "text-text-primary",
  emergencial: "text-priority-emergencial",
  vencido: "text-sla-vencido",
};

const VALOR_CLASSE: Record<Enfase, string> = {
  hero: "text-4xl font-bold",
  padrao: "text-xl font-semibold",
};

export function StatCard({
  label,
  value,
  tom = "neutro",
  enfase = "padrao",
}: {
  label: string;
  value: number;
  tom?: Tom;
  enfase?: Enfase;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
      <p className="text-[11px] font-medium tracking-wide text-text-tertiary uppercase">{label}</p>
      <p className={`mt-2 tabular-nums ${VALOR_CLASSE[enfase]} ${TOM_VALOR[tom]}`}>{value}</p>
    </div>
  );
}
