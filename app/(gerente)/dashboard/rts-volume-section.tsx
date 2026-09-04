"use client";

import { ResumoComModal } from "@/lib/ui/resumo-com-modal";

// Client component só pra poder passar a função `renderLista` pro
// ResumoComModal (client) — Server Component não pode passar função como
// prop pra um Client Component (não é serializável através da fronteira
// RSC). Mesmo motivo pelo qual RegiaoSection/RtsSection (Painel da
// gestão) já são client components — não é um padrão novo, só replicado
// aqui pro Dashboard.
type Rt = { codigo: string; nome: string; total: number };

export function RtsVolumeSection({ rts, maxVolume }: { rts: Rt[]; maxVolume: number }) {
  return (
    <ResumoComModal
      rotulo="RTs"
      itens={rts}
      limite={6}
      renderLista={(lista) => (
        <ul className="divide-y divide-border">
          {lista.map((rt) => (
            <li key={rt.codigo} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <div className="w-24 shrink-0">
                <p className="font-mono text-xs tabular-nums text-text-secondary">{rt.codigo}</p>
                <p className="mt-0.5 truncate text-xs text-text-tertiary" title={rt.nome}>
                  {rt.nome}
                </p>
              </div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-input">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(rt.total / maxVolume) * 100}%` }}
                />
              </div>
              <p className="w-6 shrink-0 text-right text-sm font-medium tabular-nums text-text-primary">
                {rt.total}
              </p>
            </li>
          ))}
        </ul>
      )}
    />
  );
}
