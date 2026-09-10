"use client";

import { useState } from "react";
import { MapaBase, type MarcadorMapa } from "@/lib/ui/mapa/mapa-base";
import { FOCUS_RING } from "@/lib/ui/styles";

export type ParadaDoDia = { codigo: string; lat: number; lng: number };

// Mapa do dia na tela do técnico — para ele ver a FORMA da rota antes de
// sair (quantas casas, em que ordem, quão espalhadas).
//
// Fechado por padrão, e o mapa só é montado quando ele abre: o técnico está
// em campo, no plano de dados dele, e a ação principal daqui já é o botão
// que abre a rota no Google Maps. Carregar tiles em toda visita seria custo
// sem pedido — coerente com a persona "mínima, poucos toques".
export function MapaDoDia({ paradas }: { paradas: ParadaDoDia[] }) {
  const [aberto, setAberto] = useState(false);

  if (paradas.length < 2) return null;

  const marcadores: MarcadorMapa[] = paradas.map((p, i) => ({
    id: `${p.codigo}-${i}`,
    posicao: { lat: p.lat, lng: p.lng },
    espec: { cor: "var(--accent)", tamanho: 26, conteudo: i + 1 },
    titulo: `${i + 1}. ${p.codigo}`,
  }));

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={`flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-input ${FOCUS_RING}`}
      >
        <span aria-hidden="true">{aberto ? "▾" : "▸"}</span>
        {aberto ? "Esconder o mapa" : `Ver as ${paradas.length} paradas no mapa`}
      </button>

      {aberto && (
        <div className="mt-2">
          <MapaBase className="h-56" marcadores={marcadores} />
        </div>
      )}
    </div>
  );
}
