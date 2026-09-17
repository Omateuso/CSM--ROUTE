"use client";

import { useId, useMemo, useState } from "react";
import { FIELD_INPUT, FOCUS_RING } from "@/lib/ui/styles";

// Sem componente genérico de busca de RT no projeto — os dois precedentes
// mais próximos (rts-manager.tsx, montar-rota-client.tsx) fazem preload
// completo da lista (~99 linhas, trivial) e filtram no client com useMemo.
// Reaproveita o mesmo padrão em vez de criar uma busca por servidor.
export type RtOpcao = {
  id: string;
  codigo: string;
  nome: string;
  endereco: string;
  bairro: string;
  capsNome: string;
};

export function RtPicker({
  rts,
  onSelecionar,
  autoFocus,
  contagemPorRt,
}: {
  rts: RtOpcao[];
  onSelecionar: (rt: RtOpcao) => void;
  autoFocus?: boolean;
  /** Quando presente, mostra "N relatórios" ao lado de cada RT que já tem algum. */
  contagemPorRt?: Record<string, number>;
}) {
  const idBusca = useId();
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (termo.length === 0) return rts.slice(0, 30);
    return rts
      .filter(
        (rt) =>
          rt.codigo.toLowerCase().includes(termo) ||
          rt.nome.toLowerCase().includes(termo) ||
          rt.endereco.toLowerCase().includes(termo) ||
          rt.bairro.toLowerCase().includes(termo) ||
          rt.capsNome.toLowerCase().includes(termo),
      )
      .slice(0, 30);
  }, [rts, busca]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={idBusca} className="text-xs font-medium text-text-secondary">
          RT / Endereço
        </label>
        <input
          id={idBusca}
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Pesquisar residência (código, nome, endereço, bairro ou CAPS)..."
          autoFocus={autoFocus}
          className={FIELD_INPUT}
        />
      </div>

      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {filtradas.length === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-surface-input px-4 py-6 text-center text-xs text-text-tertiary">
            Nenhuma RT encontrada com esse termo.
          </p>
        ) : (
          filtradas.map((rt) => (
            <button
              key={rt.id}
              type="button"
              onClick={() => onSelecionar(rt)}
              className={`flex flex-col gap-0.5 rounded-[var(--radius-sm)] border border-border p-3 text-left transition-colors hover:border-accent hover:bg-surface-input ${FOCUS_RING}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-text-primary">{rt.codigo}</span>
                <span className="text-sm text-text-primary">{rt.nome}</span>
                {!!contagemPorRt?.[rt.id] && (
                  <span className="ml-auto rounded-full bg-surface-input px-2 py-0.5 text-xs text-text-tertiary">
                    {contagemPorRt[rt.id]} relatório{contagemPorRt[rt.id] > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-tertiary">
                {rt.endereco}, {rt.bairro} · {rt.capsNome}
              </p>
            </button>
          ))
        )}
        {busca.trim().length === 0 && rts.length > 30 && (
          <p className="text-center text-xs text-text-tertiary">Mostrando as primeiras 30 — digite pra refinar.</p>
        )}
      </div>
    </div>
  );
}
