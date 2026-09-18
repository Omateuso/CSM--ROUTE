"use client";

import { useState } from "react";
import { criarZona } from "./actions";
import { InlineTextForm } from "./inline-text-form";
import { ZonaCard } from "./zona-card";
import { FOCUS_RING, TAP_TARGET } from "@/lib/ui/styles";

type Zona = { id: string; nome: string; regioes: { id: string; nome: string }[] };

export function ZonasManager({
  zonas,
  podeCriar,
  podeEditar,
}: {
  zonas: Zona[];
  podeCriar: boolean;
  podeEditar: boolean;
}) {
  const [criandoZona, setCriandoZona] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {zonas.length === 0 && !criandoZona && (
        <div className="rounded-[var(--radius-md)] border border-dashed border-border-strong px-5 py-8 text-center">
          <p className="text-sm text-text-secondary">
            Nenhuma zona cadastrada ainda.
          </p>
          <p className="mt-1 text-xs text-text-tertiary">
            Comece criando a primeira, por exemplo &ldquo;Zona Oeste&rdquo;.
          </p>
        </div>
      )}

      {zonas.map((zona) => (
        <ZonaCard
          key={zona.id}
          id={zona.id}
          nome={zona.nome}
          regioes={zona.regioes}
          podeCriar={podeCriar}
          podeEditar={podeEditar}
        />
      ))}

      {podeCriar && (
        <div className="rounded-[var(--radius-md)] bg-surface shadow-lift p-5">
          {criandoZona ? (
            <InlineTextForm
              action={criarZona}
              label="Nome da nova zona"
              placeholder="Nome da zona (ex.: Zona Oeste)"
              submitLabel="Adicionar"
              onCancel={() => setCriandoZona(false)}
              onSuccess={() => setCriandoZona(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setCriandoZona(true)}
              className={`text-sm font-medium text-accent transition-colors hover:text-accent-hover ${FOCUS_RING} ${TAP_TARGET}`}
            >
              + Nova zona
            </button>
          )}
        </div>
      )}
    </div>
  );
}
