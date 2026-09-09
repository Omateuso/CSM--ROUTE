"use client";

import { useEffect } from "react";
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import type { ParadaStatus, RotaHoje, TecnicoAoVivo } from "./tipos";

const COR_STATUS: Record<ParadaStatus, string> = {
  concluida: "#16a34a", // sla-dentro
  em_andamento: "#ea9a2e", // priority-alta
  nao_iniciada: "#9ca3af", // text-tertiary
};

function AjustarLimites({
  pontos,
}: {
  pontos: { lat: number; lng: number }[];
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || pontos.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const p of pontos) bounds.extend(p);
    map.fitBounds(bounds, 48);
    // só no carregamento — não recentraliza a cada ping/refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

// A lib não tem <Polyline> em v1 — desenha imperativo via google.maps.
function Trilha({ path, cor }: { path: { lat: number; lng: number }[]; cor: string }) {
  const map = useMap();
  useEffect(() => {
    if (!map || path.length < 2) return;
    const linha = new google.maps.Polyline({
      path,
      map,
      strokeColor: cor,
      strokeOpacity: 0.55,
      strokeWeight: 3,
    });
    return () => linha.setMap(null);
  }, [map, path, cor]);
  return null;
}

export function RotaHojeMapa({
  rotas,
  tecnicos,
}: {
  rotas: RotaHoje[];
  tecnicos: TecnicoAoVivo[];
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-96 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border-strong bg-surface-input px-6 text-center">
        <p className="max-w-sm text-sm text-text-tertiary">
          Mapa desativado — falta configurar{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>.
        </p>
      </div>
    );
  }

  const paradas = rotas.flatMap((r) => r.paradas.filter((p) => p.lat != null && p.lng != null));
  const pontosParaLimite = [
    ...paradas.map((p) => ({ lat: p.lat as number, lng: p.lng as number })),
    ...tecnicos.flatMap((t) => (t.ultima ? [{ lat: t.ultima.lat, lng: t.ultima.lng }] : [])),
  ];

  return (
    <div className="h-full min-h-96 overflow-hidden rounded-[var(--radius-md)] border border-border">
      <APIProvider apiKey={apiKey}>
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: -22.9068, lng: -43.1729 }}
          defaultZoom={11}
          gestureHandling="greedy"
          internalUsageAttributionIds={["gmp_git_agentskills_v1"]}
          style={{ width: "100%", height: "100%" }}
        >
          <AjustarLimites pontos={pontosParaLimite} />

          {tecnicos.map((t) => (
            <Trilha key={`trilha-${t.id}`} path={t.trilha} cor={t.cor} />
          ))}

          {paradas.map((p) => (
            <AdvancedMarker
              key={`${p.rtId}-${p.ordem}`}
              position={{ lat: p.lat as number, lng: p.lng as number }}
              title={`${p.ordem}. ${p.rtCodigo} — ${p.rtEndereco}${p.tecnicoNome ? ` · ${p.tecnicoNome}` : ""}`}
              zIndex={p.status === "em_andamento" ? 15 : 5}
            >
              <div
                className="flex items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow-md"
                style={{ width: 26, height: 26, backgroundColor: COR_STATUS[p.status] }}
              >
                {p.ordem}
              </div>
            </AdvancedMarker>
          ))}

          {tecnicos.map((t) =>
            t.ultima ? (
              <AdvancedMarker
                key={`tec-${t.id}`}
                position={{ lat: t.ultima.lat, lng: t.ultima.lng }}
                title={`${t.nome} · visto às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(t.ultima.em))}`}
                zIndex={40}
              >
                <div
                  className="rounded-full border-[3px] border-white shadow-lg"
                  style={{
                    width: 20,
                    height: 20,
                    backgroundColor: t.cor,
                    boxShadow: `0 0 0 4px ${t.cor}40`,
                  }}
                />
              </AdvancedMarker>
            ) : null,
          )}
        </GoogleMap>
      </APIProvider>
    </div>
  );
}
