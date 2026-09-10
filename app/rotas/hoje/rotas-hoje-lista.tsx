"use client";

import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { FOCUS_RING } from "@/lib/ui/styles";
import type { ParadaStatus, RotaHoje } from "./tipos";

// O que o gerente/gestão acompanha aqui é o AVANÇO da rota, não onde o
// técnico está — o rastreamento de posição saiu em 10/09/2026 (migration
// 0041). "Atendimento em andamento" vem de `servicos.status = em_execucao`,
// ou seja, do momento em que o técnico apertou "Iniciar atendimento".
const STATUS_TXT: Record<ParadaStatus, { rotulo: string; dot: string; texto: string }> = {
  concluida: { rotulo: "Concluída", dot: "bg-sla-dentro", texto: "text-sla-dentro" },
  em_atendimento: {
    rotulo: "Atendimento em andamento",
    dot: "bg-priority-alta",
    texto: "text-priority-alta",
  },
  // Tem serviço concluído e serviço pendente, mas ninguém atendendo agora.
  // Chamar isso de "em andamento" faria a tela avisar de um atendimento
  // que não está acontecendo.
  parcial: { rotulo: "Parcialmente atendida", dot: "bg-text-secondary", texto: "text-text-secondary" },
  nao_iniciada: { rotulo: "Não iniciada", dot: "bg-text-tertiary", texto: "text-text-tertiary" },
};

export function RotasHojeLista({
  rotas,
  rotaAtiva = null,
  onSelecionar,
  selecionavel = false,
}: {
  rotas: RotaHoje[];
  rotaAtiva?: string | null;
  onSelecionar?: (rotaId: string) => void;
  /** Só faz sentido escolher quando há mais de uma equipe em campo. */
  selecionavel?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 lg:max-h-[600px] lg:overflow-y-auto lg:pr-1">
      {rotas.map((r) => {
        const pct = r.progresso.total > 0 ? Math.round((r.progresso.feitas / r.progresso.total) * 100) : 0;
        const emAtendimento = r.paradas.filter((p) => p.status === "em_atendimento").length;

        const cabecalho = (
          <>
            <span className="flex items-baseline justify-between gap-2">
              <span className="flex items-baseline gap-1.5">
                {r.equipeNumero != null && (
                  <span className="rounded-full bg-surface-input px-1.5 font-mono text-[11px] font-semibold text-text-secondary">
                    {r.equipeNumero}
                  </span>
                )}
                <span className="text-sm font-semibold text-text-primary">{r.equipeNome}</span>
              </span>
              <span className="text-xs text-text-tertiary">
                {r.progresso.feitas}/{r.progresso.total} paradas
              </span>
            </span>
            <span className="mt-0.5 flex items-center gap-2 text-xs text-text-tertiary">
              {r.regiaoNome}
              {selecionavel && (
                <span className={rotaAtiva === r.id ? "text-accent" : "text-text-tertiary"}>
                  {rotaAtiva === r.id ? "· caminho no mapa" : "· ver caminho"}
                </span>
              )}
            </span>
          </>
        );

        return (
          <article
            key={r.id}
            className={`rounded-[var(--radius-md)] border bg-surface p-4 transition-colors ${
              rotaAtiva === r.id ? "border-accent" : "border-border"
            }`}
          >
            {selecionavel ? (
              <button
                type="button"
                onClick={() => onSelecionar?.(r.id)}
                aria-pressed={rotaAtiva === r.id}
                className={`-m-1 flex w-[calc(100%+0.5rem)] flex-col rounded-[var(--radius-sm)] p-1 text-left transition-colors hover:bg-surface-input ${FOCUS_RING}`}
              >
                {cabecalho}
              </button>
            ) : (
              <div className="flex flex-col">{cabecalho}</div>
            )}

            {/* Sinal de topo: é o que o gerente quer ver de relance. */}
            {emAtendimento > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-priority-alta">
                <span className="h-2 w-2 shrink-0 rounded-full bg-priority-alta" aria-hidden="true" />
                {emAtendimento === 1
                  ? "Atendimento em andamento"
                  : `${emAtendimento} atendimentos em andamento`}
              </p>
            )}

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-input" aria-hidden="true">
              <div className="h-full rounded-full bg-sla-dentro" style={{ width: `${pct}%` }} />
            </div>

            <ol className="mt-3 flex flex-col gap-2">
              {r.paradas.map((p) => {
                const st = STATUS_TXT[p.status];
                return (
                  <li
                    key={`${r.id}-${p.rtId}-${p.ordem}`}
                    className={`rounded-[var(--radius-sm)] border p-2.5 ${
                      p.status === "em_atendimento" ? "border-priority-alta/40 bg-priority-alta/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} aria-hidden="true" />
                      <span className="font-mono text-xs text-text-secondary">
                        {p.ordem}. {p.rtCodigo}
                      </span>
                      {p.tecnicoNome && (
                        <span className="ml-auto text-[11px] text-text-tertiary">{p.tecnicoNome}</span>
                      )}
                    </div>

                    {/* Status em texto, não só a cor do ponto — cor sozinha
                        não é sinal suficiente (regra do CLAUDE.md). */}
                    <p className={`mt-0.5 text-[11px] font-medium ${st.texto}`}>{st.rotulo}</p>

                    <p className="mt-0.5 truncate text-xs text-text-tertiary">{p.rtNome}</p>

                    {p.servicos.length > 0 && (
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {p.servicos.map((s, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs">
                            <PrioridadeBadge prioridade={s.prioridade as Prioridade} />
                            <span className="truncate text-text-secondary">{s.assunto}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {p.servicos.length === 0 && (
                      <p className="mt-1 text-[11px] text-text-tertiary">Sem serviço gerado ainda.</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </article>
        );
      })}
    </div>
  );
}
