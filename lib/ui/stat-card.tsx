// Movido de app/(gerente)/dashboard/ pra lib/ui/ (auditoria de design,
// 23/08/2026) — a Gestão já importava daqui cross-pasta, sinal de que o
// componente sempre foi compartilhado, só morava no lugar errado.
//
// `enfase` é a mudança de verdade: antes todo StatCard usava `text-3xl`
// sem distinção — a métrica "que importa agora" tinha o mesmo peso visual
// que qualquer contagem de contexto. `hero` (1 por tela, no máximo) fica
// bem maior que `padrao`; nunca os dois nomes de escala mais próximos
// coexistem — só há um degrau visível.
//
// Nova identidade (18/09/2026): rótulo em caixa normal, número com tracking
// negativo, elevação por sombra. `href` (pedido do usuário, 18/09): o KPI
// vira link pra tela/filtro que explica o número — o card inteiro é o
// alvo, sobe no hover e mostra a seta; `dica` diz aonde vai (title +
// leitor de tela).
import Link from "next/link";
import { CARD, CARD_INTERACTIVE } from "@/lib/ui/styles";

type Tom = "neutro" | "emergencial" | "vencido";
type Enfase = "hero" | "padrao";

const TOM_VALOR: Record<Tom, string> = {
  neutro: "text-text-primary",
  emergencial: "text-priority-emergencial",
  vencido: "text-sla-vencido",
};

const VALOR_CLASSE: Record<Enfase, string> = {
  hero: "text-[40px] leading-none font-semibold tracking-[-0.03em]",
  padrao: "text-2xl leading-none font-semibold tracking-[-0.02em]",
};

function Seta() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-text-tertiary transition-[transform,color] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-accent"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  tom = "neutro",
  enfase = "padrao",
  href,
  dica,
}: {
  label: string;
  value: number;
  tom?: Tom;
  enfase?: Enfase;
  /** Destino ao clicar (tela/filtro que explica o número). */
  href?: string;
  /** "Ver chamados emergenciais" — vai no title e no texto só de leitor de tela. */
  dica?: string;
}) {
  const corpo = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        {href && <Seta />}
      </div>
      <p className={`tabular-nums ${VALOR_CLASSE[enfase]} ${TOM_VALOR[tom]}`}>{value}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        title={dica}
        className={`${CARD_INTERACTIVE} group flex flex-col gap-2.5 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
      >
        {corpo}
        {dica && <span className="sr-only">{dica}</span>}
      </Link>
    );
  }

  return <div className={`${CARD} flex flex-col gap-2.5 p-5`}>{corpo}</div>;
}
