import Link from "next/link";
import { CARD, PRIMARY_BUTTON } from "@/lib/ui/styles";

// Foco único do Dashboard: o que o gerente precisa resolver antes de
// qualquer outra coisa. Nova identidade (18/09/2026): saiu o card
// rosa/laranja com "passe o mouse aqui" (informação escondida atrás do
// hover não existe no celular) — agora o total lidera em tamanho, o
// detalhamento fica sempre visível ao lado e a ação é um botão de verdade.
// A cor de alerta (vermelho) só aparece no que é de fato crítico: serviço
// travado numa rota que já passou.
function SetaKpi() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-text-tertiary opacity-60 transition-[transform,opacity] duration-150 ease-out group-hover:translate-x-0.5 group-hover:opacity-100"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function AtencaoAgoraCard({
  total,
  aguardandoValidacao,
  travados,
}: {
  total: number;
  aguardandoValidacao: number;
  travados: number;
}) {
  const emDia = total === 0;
  return (
    <section
      aria-labelledby="atencao-agora"
      className={`${CARD} grid gap-6 p-6 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] sm:items-center sm:p-7`}
    >
      <div className="flex flex-col gap-1">
        <h2 id="atencao-agora" className="text-[13px] font-medium text-text-secondary">
          Atenção agora
        </h2>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className={`text-[56px] leading-none font-semibold tracking-[-0.03em] tabular-nums ${
              emDia ? "text-sla-dentro" : "text-text-primary"
            }`}
          >
            {total}
          </span>
          <span className="text-sm text-text-secondary">
            {emDia
              ? "nada aguardando você — operação em dia"
              : total === 1
                ? "serviço precisa da sua decisão"
                : "serviços precisam da sua decisão"}
          </span>
        </div>
        {!emDia && (
          <div className="mt-4">
            <Link href="/validacao" className={PRIMARY_BUTTON}>
              Abrir Validação
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/validacao#aguardando-validacao"
          title="Ver serviços aguardando validação"
          className="group flex flex-col gap-1.5 rounded-[var(--radius-sm)] border border-border p-4 transition-[border-color,background-color] duration-150 ease-out hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="flex items-center justify-between text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums text-text-primary">
            {aguardandoValidacao}
            <SetaKpi />
          </span>
          <span className="text-xs text-text-secondary">aguardando validação</span>
        </Link>
        <Link
          href="/validacao#travados"
          title="Ver serviços travados em rota já passada"
          className={`group flex flex-col gap-1.5 rounded-[var(--radius-sm)] border p-4 transition-[border-color,background-color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            travados > 0
              ? "border-priority-emergencial bg-priority-emergencial-tint hover:shadow-lift-hover"
              : "border-border hover:border-border-strong hover:bg-surface-hover"
          }`}
        >
          <span
            className={`flex items-center justify-between text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums ${
              travados > 0 ? "text-priority-emergencial" : "text-text-primary"
            }`}
          >
            {travados}
            <SetaKpi />
          </span>
          <span
            className={`text-xs ${
              travados > 0 ? "font-medium text-priority-emergencial" : "text-text-secondary"
            }`}
          >
            travados em rota já passada
          </span>
        </Link>
      </div>
    </section>
  );
}
