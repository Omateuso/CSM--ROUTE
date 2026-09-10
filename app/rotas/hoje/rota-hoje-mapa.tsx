"use client";

import { useMemo } from "react";
import { MapaBase, type LinhaMapa, type MarcadorMapa } from "@/lib/ui/mapa/mapa-base";
import type { ParadaStatus, RotaHoje, TecnicoAoVivo, TracadoPlanejado } from "./tipos";

const COR_STATUS: Record<ParadaStatus, string> = {
  concluida: "#16a34a", // sla-dentro
  em_andamento: "#ea9a2e", // priority-alta
  nao_iniciada: "#9ca3af", // text-tertiary
};

const COR_PLANEJADO = "#1e3a6e"; // accent

const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function RotaHojeMapa({
  rotas,
  tecnicos,
  tracados = [],
  rotaAtiva = null,
}: {
  rotas: RotaHoje[];
  tecnicos: TecnicoAoVivo[];
  tracados?: TracadoPlanejado[];
  /** Rota cujo caminho está sendo mostrado. `null` = nenhuma escolhida ainda. */
  rotaAtiva?: string | null;
}) {
  const marcadores = useMemo<MarcadorMapa[]>(() => {
    const daParada = rotas.flatMap((r) =>
      r.paradas
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => {
          // Fora da rota escolhida: apagada, nunca escondida — o gerente
          // continua vendo onde estão as outras equipes.
          const foco = rotaAtiva == null || r.id === rotaAtiva;
          return {
            // A chave precisa da rota: a mesma RT pode ser parada de duas
            // rotas no mesmo dia, e `rtId-ordem` colidia (React reclamava de
            // chave duplicada e podia embaralhar os marcadores).
            id: `${r.id}-${p.rtId}-${p.ordem}`,
            posicao: { lat: p.lat as number, lng: p.lng as number },
            espec: {
              cor: COR_STATUS[p.status],
              tamanho: foco ? 26 : 20,
              conteudo: p.ordem,
              opacidade: foco ? 1 : 0.35,
            },
            titulo: `${r.equipeNome} · ${p.ordem}. ${p.rtCodigo} — ${p.rtEndereco}${p.tecnicoNome ? ` · ${p.tecnicoNome}` : ""}`,
            zIndex: foco ? (p.status === "em_andamento" ? 15 : 5) : 1,
          } satisfies MarcadorMapa;
        }),
    );

    const doTecnico = tecnicos.flatMap((t) => {
      if (!t.ultima) return [];
      const foco = rotaAtiva == null || t.rotaId === rotaAtiva;
      return [
        {
          id: `tec-${t.id}`,
          posicao: { lat: t.ultima.lat, lng: t.ultima.lng },
          // Número da equipe dentro do pino, cor da equipe (pedido do
          // usuário). Dois técnicos da mesma equipe ficam iguais de
          // propósito — quem separa é o nome no tooltip e a lista ao lado.
          espec: {
            cor: t.cor,
            tamanho: 28,
            conteudo: t.equipeNumero ?? "",
            borda: 3,
            halo: `${t.cor}40`,
            opacidade: foco ? 1 : 0.4,
          },
          titulo:
            `${t.nome}${t.equipeNome ? ` · ${t.equipeNome}` : ""} · visto às ` +
            HORA.format(new Date(t.ultima.em)) +
            (t.proxima
              ? ` · ${t.proxima.rtCodigo} a ${t.proxima.distanciaKm.toFixed(1)} km` +
                (t.proxima.duracaoMin != null ? ` (~${t.proxima.duracaoMin} min)` : "")
              : ""),
          zIndex: 40,
        } satisfies MarcadorMapa,
      ];
    });

    return [...daParada, ...doTecnico];
  }, [rotas, tecnicos, rotaAtiva]);

  const linhas = useMemo<LinhaMapa[]>(() => {
    // Sem rota escolhida (e com mais de uma em campo), nenhum caminho é
    // desenhado — cinco rotas sobrepostas não informam nada.
    if (rotaAtiva == null) return [];

    const tecnicosDaRota = tecnicos.filter((t) => t.rotaId === rotaAtiva);
    const temAoVivo = tecnicosDaRota.some((t) => t.rotaAoVivo);

    // Já percorrido: sólido e apagado. O que falta: tracejado e forte.
    const percorridas = tecnicosDaRota
      .filter((t) => t.trilha.length >= 2)
      .map((t) => ({
        id: `trilha-${t.id}`,
        pontos: t.trilha,
        cor: t.cor,
        opacidade: 0.35,
        espessura: 3,
      }));

    const aoVivo = tecnicosDaRota
      .filter((t) => t.rotaAoVivo && t.rotaAoVivo.length >= 2)
      .map((t) => ({
        id: `aovivo-${t.id}`,
        pontos: t.rotaAoVivo as { lat: number; lng: number }[],
        cor: t.cor,
        opacidade: 0.9,
        espessura: 5,
        tracejada: true,
      }));

    // O planejado da rota inteira só entra quando ninguém dela está em campo
    // com posição conhecida — senão competiria com o caminho real.
    const planejadas = temAoVivo
      ? []
      : tracados
          .filter((t) => t.rotaId === rotaAtiva)
          .map((t) => ({
            id: `planejado-${t.rotaId}`,
            pontos: t.pontos,
            cor: COR_PLANEJADO,
            opacidade: 0.55,
            espessura: 4,
            tracejada: true,
          }));

    return [...planejadas, ...percorridas, ...aoVivo];
  }, [tracados, tecnicos, rotaAtiva]);

  const tracadoAtivo = tracados.find((t) => t.rotaId === rotaAtiva) ?? null;
  const aproximado =
    tracadoAtivo?.aproximado ||
    tecnicos.some((t) => t.rotaId === rotaAtiva && t.rotaAoVivoAproximada);

  return (
    <MapaBase className="h-full min-h-96" marcadores={marcadores} linhas={linhas}>
      {linhas.length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-col gap-1 rounded-[var(--radius-sm)] border border-border bg-surface/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm">
          <p className="flex items-center gap-2 text-text-secondary">
            <span
              className="inline-block h-0.5 w-5 shrink-0"
              style={{ borderTop: "3px dashed currentColor" }}
              aria-hidden="true"
            />
            Caminho a seguir
            {tracadoAtivo && (
              <span className="text-text-tertiary">
                ({tracadoAtivo.distanciaKm.toFixed(1)} km
                {tracadoAtivo.duracaoMin != null ? ` · ${tracadoAtivo.duracaoMin} min` : ""})
              </span>
            )}
          </p>
          <p className="flex items-center gap-2 text-text-tertiary">
            <span
              className="inline-block h-0.5 w-5 shrink-0 opacity-50"
              style={{ borderTop: "3px solid currentColor" }}
              aria-hidden="true"
            />
            Já percorrido
          </p>
          {aproximado && (
            <p className="text-text-tertiary">
              Traçado em linha reta — configure a chave de rotas para seguir as ruas.
            </p>
          )}
        </div>
      )}
    </MapaBase>
  );
}
