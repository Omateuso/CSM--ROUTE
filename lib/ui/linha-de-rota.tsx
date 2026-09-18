// Linha de rota — assinatura visual do produto (nova identidade, 18/09/2026):
// uma sequência desenhada como paradas ligadas por uma linha, como a rota
// no mapa. Serve pra duas coisas que são a mesma ideia vista de ângulos
// diferentes:
//
// - No Dashboard, o pipeline de status de HOJE (a fazer → em campo →
//   concluído pelo técnico → validado), com a contagem em cada parada. É
//   a regra de negócio "concluído pelo técnico ≠ validado" virando desenho:
//   o gerente vê que ainda falta a parada dele.
// - No app do técnico, as paradas da rota do dia, na ordem, com ✓ nas já
//   concluídas — "onde estou na minha rota".
//
// Componente de servidor (sem estado): recebe as paradas prontas. Cor nunca
// é o único sinal — o número/✓ e o rótulo vão junto; a lista tem
// `aria-label` com o resumo em texto.
import Link from "next/link";
import type { ReactNode } from "react";

export type TomParada = "neutro" | "info" | "accent" | "atencao" | "sucesso" | "critico";

export type Parada = {
  /** Texto embaixo da parada (curto: "A fazer", "SRT 14"). */
  rotulo: string;
  /** O que vai dentro do círculo: contagem, índice ou "✓". */
  valor: ReactNode;
  tom?: TomParada;
  /** Preenchido (fundo sólido) — a parada "fechada"/concluída. */
  cheio?: boolean;
  /** Parada atual (anel a mais) — o técnico está aqui. */
  atual?: boolean;
  /** Texto pequeno extra sob o rótulo (ex.: "2 em revisão"). */
  nota?: string;
  /** Acessibilidade: frase completa desta parada, se o rótulo sozinho não bastar. */
  descricao?: string;
  /** Parada clicável: leva pra tela/âncora que lista esses serviços. */
  href?: string;
};

const TOM: Record<TomParada, { cor: string; tinta: string }> = {
  neutro: { cor: "var(--text-tertiary)", tinta: "var(--surface-input)" },
  info: { cor: "var(--info)", tinta: "var(--info-tint)" },
  accent: { cor: "var(--accent)", tinta: "var(--accent-tint)" },
  atencao: { cor: "var(--sla-proximo)", tinta: "var(--sla-proximo-tint)" },
  sucesso: { cor: "var(--success)", tinta: "var(--success-tint)" },
  critico: { cor: "var(--danger)", tinta: "var(--danger-tint)" },
};

export function LinhaDeRota({
  paradas,
  tamanho = "normal",
  ariaLabel,
}: {
  paradas: Parada[];
  /** `compacto` = círculos de 26px e rótulos de 11px (celular / dentro de card). */
  tamanho?: "normal" | "compacto";
  ariaLabel: string;
}) {
  if (paradas.length === 0) return null;
  const compacto = tamanho === "compacto";
  const r = compacto ? 26 : 36;
  // A linha começa no centro da primeira parada e termina no centro da
  // última: cada parada ocupa 1/n da largura, então a folga de cada lado é
  // metade disso.
  const folga = 100 / (paradas.length * 2);

  return (
    <ol aria-label={ariaLabel} className="relative m-0 flex list-none items-start p-0">
      <div
        aria-hidden="true"
        className="absolute h-0.5 bg-border-strong"
        style={{ left: `${folga}%`, right: `${folga}%`, top: r / 2 + 3 }}
      />
      {paradas.map((p, i) => {
        const tom = TOM[p.tom ?? "neutro"];
        const vazio = !p.cheio && (p.valor === 0 || p.valor === "0");
        const estilo = p.cheio
          ? { background: tom.cor, color: "var(--on-accent)", borderColor: tom.cor }
          : vazio
            ? { background: "var(--surface)", color: "var(--text-tertiary)", borderColor: "var(--border-strong)" }
            : { background: tom.tinta, color: tom.cor, borderColor: tom.cor };
        const gap = compacto ? "gap-1.5" : "gap-2.5";
        const conteudo = (
          <>
            <span
              className={`flex shrink-0 items-center justify-center rounded-full border-2 font-mono font-semibold tabular-nums transition-[transform,box-shadow] duration-150 ease-out ${
                compacto ? "text-[11px]" : "text-sm"
              } ${p.atual ? "ring-4 ring-accent/20" : ""} ${
                p.href ? "group-hover:scale-105 group-hover:ring-4 group-hover:ring-accent/15" : ""
              }`}
              style={{ width: r, height: r, ...estilo }}
            >
              {p.valor}
            </span>
            <span
              className={`px-0.5 leading-tight font-medium ${compacto ? "text-[10.5px]" : "text-xs"} ${
                vazio ? "text-text-tertiary" : "text-text-secondary"
              } ${p.href ? "group-hover:text-text-primary" : ""}`}
            >
              {p.rotulo}
              {p.nota && (
                <span className={`block font-normal text-text-tertiary ${compacto ? "text-[10px]" : "text-[11px]"}`}>
                  {p.nota}
                </span>
              )}
            </span>
          </>
        );
        return (
          <li
            key={`${p.rotulo}-${i}`}
            className="relative flex min-w-0 flex-1 flex-col items-center text-center"
            aria-current={p.atual ? "step" : undefined}
          >
            {p.href ? (
              <Link
                href={p.href}
                aria-label={p.descricao}
                className={`group flex w-full flex-col items-center rounded-[var(--radius-sm)] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${gap}`}
              >
                {conteudo}
              </Link>
            ) : (
              <span aria-label={p.descricao} className={`flex w-full flex-col items-center py-1 ${gap}`}>
                {conteudo}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
