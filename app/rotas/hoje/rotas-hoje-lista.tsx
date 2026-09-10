"use client";

import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { FOCUS_RING } from "@/lib/ui/styles";
import type { ParadaStatus, RotaHoje, TecnicoAoVivo } from "./tipos";

const STATUS_TXT: Record<ParadaStatus, { rotulo: string; classe: string }> = {
  concluida: { rotulo: "Concluída", classe: "bg-sla-dentro" },
  em_andamento: { rotulo: "Em andamento", classe: "bg-priority-alta" },
  nao_iniciada: { rotulo: "Não iniciada", classe: "bg-text-tertiary" },
};

const formatoHora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function RotasHojeLista({
  rotas,
  tecnicos,
  rotaAtiva = null,
  onSelecionar,
  selecionavel = false,
}: {
  rotas: RotaHoje[];
  tecnicos: TecnicoAoVivo[];
  rotaAtiva?: string | null;
  onSelecionar?: (rotaId: string) => void;
  /** Só faz sentido escolher quando há mais de uma equipe em campo. */
  selecionavel?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 lg:max-h-[600px] lg:overflow-y-auto lg:pr-1">
      {tecnicos.length > 0 && (
        <ul className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-xs">
          {tecnicos.map((t) => (
            <li key={t.id} className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1.5 text-text-secondary">
                {/* Mesmo símbolo do mapa: cor da equipe e o número dentro. */}
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white text-[9px] font-semibold text-white"
                  style={{ backgroundColor: t.cor }}
                  aria-hidden="true"
                >
                  {t.equipeNumero ?? ""}
                </span>
                {t.nome}
                {t.ultima ? (
                  <span className="text-text-tertiary">· {formatoHora.format(new Date(t.ultima.em))}</span>
                ) : (
                  <span className="text-text-tertiary">· sem sinal</span>
                )}
              </span>

              {/* Tempo estimado até a próxima RT — sai da mesma consulta que
                  desenha o caminho dele no mapa. Sem provedor de rota
                  configurado, a linha some em vez de mostrar número errado. */}
              {t.proxima && (
                <span className="pl-5.5 text-text-tertiary">
                  próxima:{" "}
                  <span className="font-mono text-text-secondary">{t.proxima.rtCodigo}</span>{" "}
                  {t.proxima.duracaoMin != null ? (
                    <>
                      em{" "}
                      <span className="font-semibold text-text-primary tabular-nums">
                        ~{t.proxima.duracaoMin} min
                      </span>{" "}
                    </>
                  ) : null}
                  <span className="tabular-nums">
                    ({t.proxima.distanciaKm.toFixed(1)} km
                    {t.proxima.duracaoMin == null ? " em linha reta" : ""})
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {rotas.map((r) => {
        const pct = r.progresso.total > 0 ? Math.round((r.progresso.feitas / r.progresso.total) * 100) : 0;
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
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-text-primary">{r.equipeNome}</span>
                  <span className="text-xs text-text-tertiary">
                    {r.progresso.feitas}/{r.progresso.total} paradas
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-text-tertiary">
                  {r.regiaoNome}
                  <span className={rotaAtiva === r.id ? "text-accent" : "text-text-tertiary"}>
                    {rotaAtiva === r.id ? "· caminho no mapa" : "· ver caminho"}
                  </span>
                </span>
              </button>
            ) : (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-text-primary">{r.equipeNome}</h2>
                  <span className="text-xs text-text-tertiary">
                    {r.progresso.feitas}/{r.progresso.total} paradas
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-text-tertiary">{r.regiaoNome}</p>
              </>
            )}

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-input" aria-hidden="true">
              <div className="h-full rounded-full bg-sla-dentro" style={{ width: `${pct}%` }} />
            </div>

            <ol className="mt-3 flex flex-col gap-2">
              {r.paradas.map((p) => (
                <li key={`${r.id}-${p.rtId}-${p.ordem}`} className="rounded-[var(--radius-sm)] border border-border p-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${STATUS_TXT[p.status].classe}`}
                      title={STATUS_TXT[p.status].rotulo}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-xs text-text-secondary">
                      {p.ordem}. {p.rtCodigo}
                    </span>
                    {p.tecnicoNome && (
                      <span className="ml-auto text-[11px] text-text-tertiary">{p.tecnicoNome}</span>
                    )}
                  </div>
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
              ))}
            </ol>
          </article>
        );
      })}
    </div>
  );
}
