"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CENTRO_PADRAO, TILES_ATRIBUICAO, TILES_URL, ZOOM_PADRAO } from "./config";
import { criarIcone } from "./marcador";
import type { LinhaMapa, MapaBaseProps } from "./tipos";

// Implementação real do mapa. NUNCA importe este arquivo direto: o Leaflet
// toca `window` no import e quebra no SSR — use `mapa-base.tsx`, que faz o
// dynamic(ssr:false).

// Substitui o `AjustarLimites` que os 3 mapas repetiam, cada um com uma
// cópia do mesmo useEffect + fitBounds.
function AjustarLimites({ pontos, sempre }: { pontos: { lat: number; lng: number }[]; sempre: boolean }) {
  const mapa = useMap();
  const chave = sempre ? pontos.map((p) => `${p.lat},${p.lng}`).join("|") : "uma-vez";

  useEffect(() => {
    if (pontos.length === 0) return;
    mapa.fitBounds(L.latLngBounds(pontos.map((p) => [p.lat, p.lng] as [number, number])), {
      padding: [40, 40],
    });
    // `sempre = false` reproduz o comportamento de Montar rota e Rota do
    // dia: ajusta uma vez no carregamento e nunca mais, pra não recentralizar
    // o mapa a cada seleção/ping e perder o contexto visual do gerente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, chave]);

  return null;
}

function Traco({ linha }: { linha: LinhaMapa }) {
  return (
    <Polyline
      positions={linha.pontos.map((p) => [p.lat, p.lng] as [number, number])}
      pathOptions={{
        color: linha.cor,
        opacity: linha.opacidade ?? 0.55,
        weight: linha.espessura ?? 3,
        dashArray: linha.tracejada ? "6 8" : undefined,
      }}
    />
  );
}

export function MapaBaseInterno({
  marcadores,
  linhas = [],
  ajustarA,
  ajustarSempre = false,
  className = "",
  children,
}: MapaBaseProps) {
  const pontosParaAjuste = ajustarA ?? marcadores.map((m) => m.posicao);

  return (
    <div className={`relative overflow-hidden rounded-[var(--radius-md)] border border-border ${className}`}>
      <MapContainer
        center={[CENTRO_PADRAO.lat, CENTRO_PADRAO.lng]}
        zoom={ZOOM_PADRAO}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url={TILES_URL} attribution={TILES_ATRIBUICAO} />
        <AjustarLimites pontos={pontosParaAjuste} sempre={ajustarSempre} />

        {linhas.map((linha) => (
          <Traco key={linha.id} linha={linha} />
        ))}

        {marcadores.map((m) => (
          <Marker
            key={m.id}
            position={[m.posicao.lat, m.posicao.lng]}
            icon={criarIcone(m.espec)}
            zIndexOffset={m.zIndex ?? 0}
            title={m.titulo}
            eventHandlers={m.aoClicar ? { click: m.aoClicar } : undefined}
          >
            {m.popup ? <Popup>{m.popup}</Popup> : null}
          </Marker>
        ))}
      </MapContainer>

      {children}
    </div>
  );
}
