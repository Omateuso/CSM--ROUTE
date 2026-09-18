"use client";

import Link from "next/link";
import { ResumoComModal } from "@/lib/ui/resumo-com-modal";
import { PlacaRt, nomeSemCodigo } from "@/lib/ui/placa-rt";

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
            <li key={rt.codigo}>
              <Link
                href={`/chamados?busca=${encodeURIComponent(rt.codigo)}`}
                title={`Ver os ${rt.total} chamados em aberto de ${rt.codigo}`}
                className="group -mx-2 flex items-center gap-4 rounded-[var(--radius-sm)] px-2 py-3 transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
              <div className="flex w-44 shrink-0 items-center gap-2">
                <PlacaRt codigo={rt.codigo} />
                <p className="truncate text-xs text-text-secondary" title={rt.nome}>
                  {nomeSemCodigo(rt.nome, rt.codigo)}
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    />
  );
}
