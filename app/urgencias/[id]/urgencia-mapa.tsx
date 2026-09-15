"use client";

import { useMemo } from "react";
import { MapaBase, type MarcadorMapa } from "@/lib/ui/mapa/mapa-base";

export type CandidatoMapa = {
  rotaId: string;
  equipeId: string;
  equipeNome: string;
  lat: number;
  lng: number;
  recomendada: boolean;
};

// Mapa de apoio ao despacho (seção 13 do prompt): a RT da urgência em
// destaque + um marcador por equipe candidata, na posição da parada de
// referência dela hoje (próxima pendente, ou a última se a rota já
// terminou) — é a mesma posição que lib/routing/urgencia-impacto.ts usa
// pra calcular a distância, então mapa e números batem entre si. Sem GPS ao
// vivo do técnico (decisão de 11/09/2026) — não existe "ponto azul" andando
// sozinho aqui, só a referência estática de hoje.
export function UrgenciaMapa({
  rt,
  candidatos,
}: {
  rt: { lat: number; lng: number; codigo: string; endereco: string };
  candidatos: CandidatoMapa[];
}) {
  const marcadores = useMemo<MarcadorMapa[]>(() => {
    const rtMarcador: MarcadorMapa = {
      id: "rt-urgencia",
      posicao: { lat: rt.lat, lng: rt.lng },
      espec: { cor: "var(--danger)", tamanho: 26, borda: 3, pulsa: true },
      titulo: `${rt.codigo} — ${rt.endereco}`,
      zIndex: 40,
    };
    const candidatosMarcadores: MarcadorMapa[] = candidatos.map((c) => ({
      // Chave por ROTA, não por equipe — uma equipe pode ter mais de uma
      // rota confirmada no mesmo dia (ex.: uma rota normal + uma avulsa
      // aberta por um despacho de urgência anterior), e `equipe-${id}`
      // sozinho colidia nesse caso (achado real, 16/09/2026).
      id: `equipe-${c.equipeId}-${c.rotaId}`,
      posicao: { lat: c.lat, lng: c.lng },
      espec: {
        cor: c.recomendada ? "var(--sla-dentro)" : "var(--text-tertiary)",
        tamanho: c.recomendada ? 24 : 18,
      },
      titulo: c.equipeNome,
      zIndex: c.recomendada ? 30 : 10,
    }));
    return [rtMarcador, ...candidatosMarcadores];
  }, [rt, candidatos]);

  const ajustarA = useMemo(
    () => [{ lat: rt.lat, lng: rt.lng }, ...candidatos.map((c) => ({ lat: c.lat, lng: c.lng }))],
    [rt, candidatos],
  );

  return <MapaBase className="h-full min-h-72" marcadores={marcadores} ajustarA={ajustarA} />;
}
