"use client";

import { useMemo } from "react";
import { MapaBase, type LinhaMapa, type MarcadorMapa } from "@/lib/ui/mapa/mapa-base";
import type { ParadaStatus, RotaHoje, TracadoPlanejado } from "./tipos";

const COR_STATUS: Record<ParadaStatus, string> = {
  concluida: "#16a34a", // sla-dentro
  em_atendimento: "#ea9a2e", // priority-alta
  parcial: "#64748b", // cinza mais escuro: começou, mas ninguém está nela agora
  nao_iniciada: "#9ca3af", // text-tertiary
};

const COR_CAMINHO = "#1e3a6e"; // accent

export function RotaHojeMapa({
  rotas,
  tracados = [],
  rotaAtiva = null,
}: {
  rotas: RotaHoje[];
  tracados?: TracadoPlanejado[];
  /** Rota cujo caminho está sendo mostrado. `null` = nenhuma escolhida ainda. */
  rotaAtiva?: string | null;
}) {
  // O mapa mostra PARADAS e o caminho planejado entre elas. A posição do
  // técnico saiu do sistema em 10/09/2026 (migration 0041) — o que o gerente
  // acompanha aqui é o avanço da rota pelo status de cada parada, não o
  // deslocamento de ninguém.
  const marcadores = useMemo<MarcadorMapa[]>(
    () =>
      rotas.flatMap((r) =>
        r.paradas
          .filter((p) => p.lat != null && p.lng != null)
          .map((p) => {
            // Fora da rota escolhida: apagada, nunca escondida.
            const foco = rotaAtiva == null || r.id === rotaAtiva;
            return {
              // A chave precisa da rota: a mesma RT pode ser parada de duas
              // rotas no mesmo dia, e `rtId-ordem` colidia.
              id: `${r.id}-${p.rtId}-${p.ordem}`,
              posicao: { lat: p.lat as number, lng: p.lng as number },
              espec: {
                cor: COR_STATUS[p.status],
                tamanho: foco ? 26 : 20,
                conteudo: p.ordem,
                opacidade: foco ? 1 : 0.35,
                // Atendimento em andamento pulsa — é a parada que o gerente
                // precisa achar no mapa sem procurar.
                pulsa: foco && p.status === "em_atendimento",
              },
              titulo:
                `${r.equipeNome} · ${p.ordem}. ${p.rtCodigo} — ${p.rtEndereco}` +
                (p.tecnicoNome ? ` · ${p.tecnicoNome}` : "") +
                (p.status === "em_atendimento" ? " · atendimento em andamento" : ""),
              zIndex: foco ? (p.status === "em_atendimento" ? 15 : 5) : 1,
            } satisfies MarcadorMapa;
          }),
      ),
    [rotas, rotaAtiva],
  );

  const linhas = useMemo<LinhaMapa[]>(() => {
    // Sem rota escolhida (e com mais de uma em campo), nenhum caminho é
    // desenhado — várias rotas sobrepostas não informam nada.
    if (rotaAtiva == null) return [];
    return tracados
      .filter((t) => t.rotaId === rotaAtiva)
      .map((t) => ({
        id: `caminho-${t.rotaId}`,
        pontos: t.pontos,
        cor: COR_CAMINHO,
        opacidade: 0.55,
        espessura: 4,
        tracejada: true,
      }));
  }, [tracados, rotaAtiva]);

  const tracadoAtivo = tracados.find((t) => t.rotaId === rotaAtiva) ?? null;

  return (
    <MapaBase className="h-full min-h-96" marcadores={marcadores} linhas={linhas}>
      {linhas.length > 0 && tracadoAtivo && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-col gap-1 rounded-[var(--radius-sm)] border border-border bg-surface/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm">
          <p className="flex items-center gap-2 text-text-secondary">
            <span
              className="inline-block h-0.5 w-5 shrink-0"
              style={{ borderTop: `3px dashed ${COR_CAMINHO}` }}
              aria-hidden="true"
            />
            Caminho da equipe
            <span className="text-text-tertiary">
              ({tracadoAtivo.distanciaKm.toFixed(1)} km
              {tracadoAtivo.duracaoMin != null ? ` · ${tracadoAtivo.duracaoMin} min` : ""})
            </span>
          </p>
          {tracadoAtivo.aproximado && (
            <p className="text-text-tertiary">
              Traçado em linha reta — configure a chave de rotas para seguir as ruas.
            </p>
          )}
        </div>
      )}
    </MapaBase>
  );
}
