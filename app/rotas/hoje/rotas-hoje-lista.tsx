import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
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
}: {
  rotas: RotaHoje[];
  tecnicos: TecnicoAoVivo[];
}) {
  return (
    <div className="flex flex-col gap-4 lg:max-h-[600px] lg:overflow-y-auto lg:pr-1">
      {tecnicos.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-xs">
          {tecnicos.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1.5 text-text-secondary">
              <span
                className="h-2.5 w-2.5 rounded-full border border-white"
                style={{ backgroundColor: t.cor }}
                aria-hidden="true"
              />
              {t.nome}
              {t.ultima ? (
                <span className="text-text-tertiary">· {formatoHora.format(new Date(t.ultima.em))}</span>
              ) : (
                <span className="text-text-tertiary">· sem sinal</span>
              )}
            </span>
          ))}
        </div>
      )}

      {rotas.map((r) => {
        const pct = r.progresso.total > 0 ? Math.round((r.progresso.feitas / r.progresso.total) * 100) : 0;
        return (
          <article key={r.id} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-text-primary">{r.equipeNome}</h2>
              <span className="text-xs text-text-tertiary">
                {r.progresso.feitas}/{r.progresso.total} paradas
              </span>
            </div>
            <p className="mt-0.5 text-xs text-text-tertiary">{r.regiaoNome}</p>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-input" aria-hidden="true">
              <div className="h-full rounded-full bg-sla-dentro" style={{ width: `${pct}%` }} />
            </div>

            <ol className="mt-3 flex flex-col gap-2">
              {r.paradas.map((p) => (
                <li key={`${p.rtId}-${p.ordem}`} className="rounded-[var(--radius-sm)] border border-border p-2.5">
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
