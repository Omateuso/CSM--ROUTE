"use client";

import { useEffect } from "react";
// "Map" renomeado pra GoogleMap: o nome original colide com o Map nativo
// do JS que este arquivo também usa (candidatasPorId), e o import
// silenciosamente vencia o global, quebrando o `new Map(...)` mais abaixo.
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import type { RtParaRota } from "./montar-rota-client";
import type { Candidata } from "@/lib/routing/intelligent-route";

function AjustarLimites({ rts }: { rts: RtParaRota[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || rts.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const rt of rts) bounds.extend({ lat: rt.lat, lng: rt.lng });
    map.fitBounds(bounds, 32);
    // só ajusta uma vez, no carregamento — não fica recentralizando o
    // mapa a cada seleção (perderia o contexto visual do gerente).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

export function MontarRotaMapa({
  rts,
  rotaIds,
  candidatas,
  onSelecionar,
}: {
  rts: RtParaRota[];
  rotaIds: string[];
  candidatas: Candidata[];
  onSelecionar: (rtId: string) => void;
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

  const candidatasPorId = new Map(candidatas.map((c) => [c.rtId, c]));

  return (
    <div className="h-full min-h-96 overflow-hidden rounded-[var(--radius-md)] border border-border">
      <APIProvider apiKey={apiKey}>
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: -22.9068, lng: -43.1729 }}
          defaultZoom={11}
          gestureHandling="greedy"
          disableDefaultUI={false}
          internalUsageAttributionIds={["gmp_git_agentskills_v1"]}
          style={{ width: "100%", height: "100%" }}
        >
          <AjustarLimites rts={rts} />
          {rts.map((rt) => {
            const posicaoNaRota = rotaIds.indexOf(rt.id);
            const selecionada = posicaoNaRota !== -1;
            const candidata = candidatasPorId.get(rt.id);

            // 3 estados visuais (item 13 do spec): selecionada (numerada,
            // destaque máximo), candidata (destacada, cor pelo rótulo),
            // ou fora do conjunto relevante (apagada, nunca escondida).
            let tamanho = 14;
            let cor = "var(--text-muted)";
            let conteudo: string | number = "";
            let zIndex = 1;

            if (selecionada) {
              tamanho = 30;
              cor = "var(--accent)";
              conteudo = posicaoNaRota + 1;
              zIndex = 30;
            } else if (candidata) {
              tamanho = candidata.rotulo === "recomendada" ? 28 : 22;
              cor =
                candidata.rotulo === "recomendada"
                  ? "var(--sla-dentro)"
                  : candidata.rotulo === "boa_opcao"
                    ? "var(--priority-alta)"
                    : "var(--text-tertiary)";
              conteudo = candidata.totalAbertos > 0 ? candidata.totalAbertos : "";
              zIndex = candidata.rotulo === "recomendada" ? 20 : 10;
            }

            return (
              <AdvancedMarker
                key={rt.id}
                position={{ lat: rt.lat, lng: rt.lng }}
                onClick={() => candidata && onSelecionar(rt.id)}
                title={`${rt.endereco}${candidata ? ` — ${candidata.motivo}` : ""}`}
                zIndex={zIndex}
              >
                <div
                  className={`flex items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-md transition-all ${candidata && !selecionada ? "cursor-pointer" : ""}`}
                  style={{
                    width: tamanho,
                    height: tamanho,
                    backgroundColor: cor,
                    opacity: !selecionada && !candidata ? 0.35 : 1,
                  }}
                >
                  {conteudo}
                </div>
              </AdvancedMarker>
            );
          })}
        </GoogleMap>
      </APIProvider>
    </div>
  );
}
