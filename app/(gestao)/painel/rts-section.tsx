"use client";

import { useState } from "react";
import { Modal } from "@/lib/ui/modal";
import { FOCUS_RING } from "@/lib/ui/styles";

export type RtLinha = { codigo: string; nome: string; total: number };

// Mesmo limite da RegiaoSection (6) — as duas ficam lado a lado no
// painel, então precisam terminar na mesma altura.
const LIMITE_INLINE = 6;

function ListaRts({ rts, maxVolume }: { rts: RtLinha[]; maxVolume: number }) {
  if (rts.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-text-tertiary">Nenhum chamado em aberto.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {rts.map((rt) => (
        <li key={rt.codigo} className="flex items-center gap-4 px-4 py-2.5">
          <div className="w-20 shrink-0">
            <p className="font-mono text-xs tabular-nums text-text-secondary">{rt.codigo}</p>
          </div>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-input">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(rt.total / maxVolume) * 100}%` }} />
          </div>
          <p className="w-6 shrink-0 text-right text-sm font-medium tabular-nums text-text-primary">{rt.total}</p>
        </li>
      ))}
    </ul>
  );
}

// Mesmo raciocínio da RegiaoSection: mostra só as top 8 (já ordenadas por
// volume) e um botão pra ver a lista completa de RTs com chamado em
// aberto, num modal — sem estourar a altura do painel.
export function RtsSection({ rts }: { rts: RtLinha[] }) {
  const [aberto, setAberto] = useState(false);
  const inline = rts.slice(0, LIMITE_INLINE);
  const maxVolume = rts[0]?.total ?? 1;

  return (
    <div>
      <h2 className="text-sm font-semibold text-text-primary">RTs com maior volume</h2>
      <p className="mt-1 text-xs text-text-tertiary">Chamados em aberto por RT.</p>
      <div className="mt-3 rounded-[var(--radius-md)] border border-border bg-surface">
        <ListaRts rts={inline} maxVolume={maxVolume} />
      </div>

      {rts.length > LIMITE_INLINE && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className={`mt-2 text-xs font-medium text-accent transition-colors hover:text-accent-hover ${FOCUS_RING}`}
        >
          Ver todas as {rts.length} RTs →
        </button>
      )}

      <Modal open={aberto} title="Chamados por RT" onClose={() => setAberto(false)}>
        <div className="max-h-[70vh] overflow-y-auto rounded-[var(--radius-md)] border border-border">
          <ListaRts rts={rts} maxVolume={maxVolume} />
        </div>
        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setAberto(false)}
            className={`text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING}`}
          >
            Fechar
          </button>
        </div>
      </Modal>
    </div>
  );
}
