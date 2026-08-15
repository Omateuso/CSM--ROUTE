"use client";

import { useState } from "react";
import { renomearZona, excluirZona, criarRegiao } from "./actions";
import { InlineTextForm } from "./inline-text-form";
import { DeleteTrigger, ConfirmDeleteBar } from "./confirm-delete";
import { RegiaoRow } from "./regiao-row";
import { FOCUS_RING, TAP_TARGET } from "@/lib/ui/styles";

type Regiao = { id: string; nome: string };

export function ZonaCard({
  id,
  nome,
  regioes,
}: {
  id: string;
  nome: string;
  regioes: Regiao[];
}) {
  const [modo, setModo] = useState<"visualizando" | "editando" | "excluindo">("visualizando");
  const [adicionandoRegiao, setAdicionandoRegiao] = useState(false);

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
            <div className="flex items-baseline gap-2.5">
              <h2 className="text-base font-semibold text-text-primary">{nome}</h2>
              <span className="rounded-[var(--radius-sm)] border border-border-strong px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-text-tertiary">
                {regioes.length} {regioes.length === 1 ? "região" : "regiões"}
              </span>
            </div>
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
          </div>
        )}
      </header>

      <ul className="mt-3 ml-1 divide-y divide-border border-l border-border pl-4">
        {regioes.map((regiao) => (
          <RegiaoRow key={regiao.id} id={regiao.id} nome={regiao.nome} />
        ))}

        {regioes.length === 0 && !adicionandoRegiao && (
          <li className="py-2 text-sm text-text-tertiary">
            Nenhuma região cadastrada nessa zona.
          </li>
        )}

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
      </ul>
    </section>
  );
}
