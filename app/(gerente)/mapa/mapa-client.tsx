"use client";

import { useMemo } from "react";
import { MapaBase, type MarcadorMapa } from "@/lib/ui/mapa/mapa-base";
import { PlacaRt } from "@/lib/ui/placa-rt";

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

export function MapaClient({ rts }: { rts: RtMarker[] }) {
  const marcadores = useMemo<MarcadorMapa[]>(
    () =>
      rts.map((rt) => {
        const info = NIVEL_INFO[rt.nivel];
        return {
          id: rt.id,
          posicao: { lat: rt.lat, lng: rt.lng },
          espec: {
            cor: info.cor,
            tamanho: info.tamanho,
            conteudo: rt.totalAbertos > 0 ? rt.totalAbertos : "",
            pulsa: info.pulsa,
          },
          titulo: rt.codigo,
          popup: (
            <div className="min-w-48">
              <p><PlacaRt codigo={rt.codigo} /></p>
              <p className="text-sm font-medium text-text-primary">{rt.endereco}</p>
              <p className="mt-2 text-xs text-text-secondary">{info.label}</p>
              <p className="mt-1 text-xs text-text-secondary">
                {rt.totalAbertos} chamado{rt.totalAbertos === 1 ? "" : "s"} em aberto
                {rt.emergenciais > 0 && ` · ${rt.emergenciais} emergencial(is)`}
                {rt.vencidos > 0 && ` · ${rt.vencidos} com SLA vencido`}
              </p>
            </div>
          ),
        } satisfies MarcadorMapa;
      }),
    [rts],
  );

  return (
    <MapaBase className="h-[70vh] min-h-96" marcadores={marcadores} ajustarSempre>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-[var(--radius-sm)] border border-border bg-surface/95 p-3 text-xs shadow-sm backdrop-blur-sm">
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
    </MapaBase>
  );
}
