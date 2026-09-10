"use client";

import { useMemo } from "react";
import { MapaBase, type MarcadorMapa } from "@/lib/ui/mapa/mapa-base";
import type { RtParaRota } from "./montar-rota-client";
import type { Candidata } from "@/lib/routing/intelligent-route";

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
  const marcadores = useMemo<MarcadorMapa[]>(() => {
    const candidatasPorId = new Map(candidatas.map((c) => [c.rtId, c]));

    return rts.map((rt) => {
      const posicaoNaRota = rotaIds.indexOf(rt.id);
      const selecionada = posicaoNaRota !== -1;
      const candidata = candidatasPorId.get(rt.id);

      // 3 estados visuais (item 13 do spec): selecionada (numerada,
      // destaque máximo), candidata (destacada, cor pelo rótulo), ou fora
      // do conjunto relevante (apagada, nunca escondida).
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

      return {
        id: rt.id,
        posicao: { lat: rt.lat, lng: rt.lng },
        espec: {
          cor,
          tamanho,
          conteudo,
          opacidade: !selecionada && !candidata ? 0.35 : 1,
        },
        titulo: `${rt.endereco}${candidata ? ` — ${candidata.motivo}` : ""}`,
        zIndex,
        aoClicar: candidata ? () => onSelecionar(rt.id) : undefined,
      } satisfies MarcadorMapa;
    });
  }, [rts, rotaIds, candidatas, onSelecionar]);

  return (
    <MapaBase
      className="h-full min-h-96"
      marcadores={marcadores}
      // Enquadra uma vez, no carregamento — não fica recentralizando a cada
      // seleção (perderia o contexto visual do gerente).
      ajustarA={rts.map((rt) => ({ lat: rt.lat, lng: rt.lng }))}
    />
  );
}
