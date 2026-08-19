"use client";

import { useEffect, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";

export type Nivel = "critico" | "emergencial" | "vencido" | "alta" | "ok" | "sem_chamados";

export type RtMarker = {
  id: string;
  codigo: string;
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
  totalAbertos: number;
  emergenciais: number;
  vencidos: number;
  nivel: Nivel;
};

const NIVEL_INFO: Record<Nivel, { cor: string; label: string; tamanho: number; pulsa: boolean }> = {
  critico: { cor: "var(--priority-emergencial)", label: "Emergencial + SLA vencido", tamanho: 34, pulsa: true },
  emergencial: { cor: "var(--priority-emergencial)", label: "Emergencial", tamanho: 28, pulsa: false },
  vencido: { cor: "var(--sla-vencido)", label: "SLA vencido", tamanho: 28, pulsa: false },
  alta: { cor: "var(--priority-alta)", label: "Alta prioridade", tamanho: 26, pulsa: false },
  ok: { cor: "var(--sla-dentro)", label: "Chamados em aberto, dentro do prazo", tamanho: 24, pulsa: false },
  sem_chamados: { cor: "var(--text-muted)", label: "Sem chamados em aberto", tamanho: 14, pulsa: false },
};

const LEGENDA: { nivel: Nivel; texto: string }[] = [
  { nivel: "critico", texto: "Emergencial + SLA vencido" },
  { nivel: "emergencial", texto: "Emergencial" },
  { nivel: "vencido", texto: "SLA vencido" },
  { nivel: "alta", texto: "Alta prioridade" },
  { nivel: "ok", texto: "Em aberto, dentro do prazo" },
  { nivel: "sem_chamados", texto: "Sem chamados" },
];

function AjustarLimites({ rts }: { rts: RtMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || rts.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const rt of rts) bounds.extend({ lat: rt.lat, lng: rt.lng });
    map.fitBounds(bounds, 32);
  }, [map, rts]);

  return null;
}

function Marcador({ rt, aberto, onAbrir, onFechar }: {
  rt: RtMarker;
  aberto: boolean;
  onAbrir: () => void;
  onFechar: () => void;
}) {
  const info = NIVEL_INFO[rt.nivel];

  return (
    <AdvancedMarker position={{ lat: rt.lat, lng: rt.lng }} onClick={onAbrir} title={rt.codigo}>
      <div className="relative flex items-center justify-center">
        {info.pulsa && (
          <span
            className="absolute rounded-full opacity-60"
            style={{
              width: info.tamanho + 16,
              height: info.tamanho + 16,
              backgroundColor: info.cor,
              animation: "marker-pulse 1.8s ease-out infinite",
            }}
            aria-hidden="true"
          />
        )}
        <div
          className="relative flex items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-md"
          style={{ width: info.tamanho, height: info.tamanho, backgroundColor: info.cor }}
        >
          {rt.totalAbertos > 0 ? rt.totalAbertos : ""}
        </div>
      </div>

      {aberto && (
        <InfoWindow position={{ lat: rt.lat, lng: rt.lng }} onCloseClick={onFechar}>
          <div className="min-w-48 p-1">
            <p className="font-mono text-xs text-neutral-500">{rt.codigo}</p>
            <p className="text-sm font-medium text-neutral-900">{rt.endereco}</p>
            <p className="mt-2 text-xs text-neutral-600">{info.label}</p>
            <p className="mt-1 text-xs text-neutral-600">
              {rt.totalAbertos} chamado{rt.totalAbertos === 1 ? "" : "s"} em aberto
              {rt.emergenciais > 0 && ` · ${rt.emergenciais} emergencial(is)`}
              {rt.vencidos > 0 && ` · ${rt.vencidos} com SLA vencido`}
            </p>
          </div>
        </InfoWindow>
      )}
    </AdvancedMarker>
  );
}

export function MapaClient({ rts }: { rts: RtMarker[] }) {
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex h-[70vh] min-h-96 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border-strong bg-surface-input px-6 text-center">
        <p className="max-w-sm text-sm text-text-tertiary">
          Mapa desativado — falta configurar{" "}
          <code className="font-mono text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> no{" "}
          <code className="font-mono text-xs">.env.local</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] min-h-96 overflow-hidden rounded-[var(--radius-md)] border border-border">
      <APIProvider apiKey={apiKey}>
        <Map
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: -22.9068, lng: -43.1729 }}
          defaultZoom={11}
          gestureHandling="greedy"
          disableDefaultUI={false}
          internalUsageAttributionIds={["gmp_git_agentskills_v1"]}
          style={{ width: "100%", height: "100%" }}
        >
          <AjustarLimites rts={rts} />
          {rts.map((rt) => (
            <Marcador
              key={rt.id}
              rt={rt}
              aberto={selecionada === rt.id}
              onAbrir={() => setSelecionada(rt.id)}
              onFechar={() => setSelecionada(null)}
            />
          ))}
        </Map>
      </APIProvider>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-[var(--radius-sm)] border border-border bg-surface/95 p-3 text-xs shadow-sm backdrop-blur-sm">
        <p className="mb-2 font-medium text-text-primary">Nível de atenção</p>
        <ul className="flex flex-col gap-1.5">
          {LEGENDA.map(({ nivel, texto }) => (
            <li key={nivel} className="flex items-center gap-2 text-text-secondary">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white/60"
                style={{ backgroundColor: NIVEL_INFO[nivel].cor }}
                aria-hidden="true"
              />
              {texto}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
