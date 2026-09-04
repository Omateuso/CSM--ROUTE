"use client";

import { useMemo, useState } from "react";
import { renomearZona, excluirZona, criarRegiao } from "./actions";
import { InlineTextForm } from "./inline-text-form";
import { DeleteTrigger, ConfirmDeleteBar } from "./confirm-delete";
import { RegiaoRow } from "./regiao-row";
import { FOCUS_RING, TAP_TARGET, FIELD_INPUT } from "@/lib/ui/styles";

type Regiao = { id: string; nome: string };

export function ZonaCard({
  id,
  nome,
  regioes,
  podeCriar,
  podeEditar,
}: {
  id: string;
  nome: string;
  regioes: Regiao[];
  podeCriar: boolean;
  podeEditar: boolean;
}) {
  const [modo, setModo] = useState<"visualizando" | "editando" | "excluindo">("visualizando");
  const [adicionandoRegiao, setAdicionandoRegiao] = useState(false);
  // Lista fechada por padrão (25/08/2026, pedido do usuário — scrollar até
  // achar a zona certa custava tempo demais com muitas zonas/regiões).
  const [expandido, setExpandido] = useState(false);
  const [busca, setBusca] = useState("");

  const regioesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return regioes;
    return regioes.filter((r) => r.nome.toLowerCase().includes(termo));
  }, [regioes, busca]);

  return (
    <section className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
      <header>
        {modo === "editando" && (
          <InlineTextForm
            action={renomearZona}
            hiddenFields={{ id }}
            defaultValue={nome}
            label={`Renomear zona ${nome}`}
            placeholder="Nome da zona"
            submitLabel="Salvar"
            onCancel={() => setModo("visualizando")}
            onSuccess={() => setModo("visualizando")}
          />
        )}

        {modo === "excluindo" && (
          <ConfirmDeleteBar
            action={excluirZona}
            id={id}
            onCancel={() => setModo("visualizando")}
          />
        )}

        {modo === "visualizando" && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <button
              type="button"
              onClick={() => setExpandido((v) => !v)}
              aria-expanded={expandido}
              className={`-mx-1 -my-1 flex items-center gap-2.5 rounded-[var(--radius-sm)] px-1 py-1 text-left transition-colors hover:bg-surface-input ${FOCUS_RING}`}
            >
              <span
                aria-hidden="true"
                className={`inline-block text-xs text-text-tertiary transition-transform ${expandido ? "rotate-90" : ""}`}
              >
                ▸
              </span>
              <h2 className="text-base font-semibold text-text-primary">{nome}</h2>
              <span className="rounded-[var(--radius-sm)] border border-border-strong px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-text-tertiary">
                {regioes.length} {regioes.length === 1 ? "região" : "regiões"}
              </span>
            </button>
            {podeEditar && (
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModo("editando")}
                  aria-label={`Renomear zona ${nome}`}
                  className={`text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING} ${TAP_TARGET}`}
                >
                  Renomear
                </button>
                <DeleteTrigger
                  onClick={() => setModo("excluindo")}
                  label="Excluir zona"
                  ariaLabel={`Excluir zona ${nome}`}
                />
              </div>
            )}
          </div>
        )}
      </header>

      {expandido && (
        <div className="mt-3 ml-1 border-l border-border pl-4">
          {regioes.length > 0 && (
            <div className="pb-2">
              <label className="sr-only" htmlFor={`busca-regiao-${id}`}>
                Buscar região em {nome}
              </label>
              <input
                id={`busca-regiao-${id}`}
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar região..."
                className={FIELD_INPUT}
              />
            </div>
          )}

          <ul className="divide-y divide-border">
            {regioesFiltradas.map((regiao) => (
              <RegiaoRow key={regiao.id} id={regiao.id} nome={regiao.nome} podeEditar={podeEditar} />
            ))}

            {regioes.length === 0 && !adicionandoRegiao && (
              <li className="py-2 text-sm text-text-tertiary">
                Nenhuma região cadastrada nessa zona.
              </li>
            )}

            {regioes.length > 0 && regioesFiltradas.length === 0 && (
              <li className="py-2 text-sm text-text-tertiary">
                Nenhuma região encontrada com essa busca.
              </li>
            )}

            {podeCriar && (
              <li className="py-2">
                {adicionandoRegiao ? (
                  <InlineTextForm
                    action={criarRegiao}
                    hiddenFields={{ zonaId: id }}
                    label={`Nome da nova região em ${nome}`}
                    placeholder="Nome da região"
                    submitLabel="Adicionar"
                    onCancel={() => setAdicionandoRegiao(false)}
                    onSuccess={() => setAdicionandoRegiao(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdicionandoRegiao(true)}
                    className={`text-xs font-medium text-accent transition-colors hover:text-accent-hover ${FOCUS_RING} ${TAP_TARGET}`}
                  >
                    + Adicionar região
                  </button>
                )}
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
