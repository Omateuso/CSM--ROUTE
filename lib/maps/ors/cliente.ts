import { criarLimitador } from "@/lib/limitador";
import {
  deLngLat,
  paraLngLat,
  type ElementoMatrizRota,
  type ProvedorRotas,
  type TracadoRota,
} from "../tipos";

// Adaptador OpenRouteService — provedor padrão desde 10/09/2026.
//
// Por que ORS e não o OSRM público: a política do servidor de demonstração
// do OSRM veda uso em produção (1 req/s, sem garantia). O plano gratuito do
// ORS dá 2.500 requisições/dia cobrindo Directions e Matrix, o que sobra
// pro volume daqui (98 RTs, poucas rotas montadas por dia).
//
// Server-only: a chave nunca pode ir pro bundle do client, então NÃO existe
// variante NEXT_PUBLIC dela. Quem chama é sempre server action / API route.
//
// Coordenada: ORS espera [longitude, latitude]. A inversão está confinada
// em `paraLngLat`/`deLngLat` (lib/maps/tipos.ts).

const BASE = "https://api.openrouteservice.org";
const PERFIL = "driving-car";

// O plano gratuito limita por minuto (Directions e Matrix têm tetos
// próprios); 2/s fica confortavelmente abaixo dos dois e o volume daqui
// nunca chega perto.
const limitador = criarLimitador(2);

function chave(): string {
  const k = process.env.ORS_API_KEY;
  if (!k) throw new Error("ORS_API_KEY não configurada no servidor.");
  return k;
}

async function postar(caminho: string, corpo: unknown): Promise<Record<string, unknown>> {
  await limitador.aguardarVez();
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: "POST",
    headers: {
      Authorization: chave(),
      "Content-Type": "application/json",
      Accept: "application/json, application/geo+json",
    },
    body: JSON.stringify(corpo),
  });

  if (!resposta.ok) {
    // 403/429 aqui costumam ser cota estourada — quem chama trata caindo
    // pra Haversine, então a mensagem só precisa ser diagnosticável.
    throw new Error(`ORS respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`);
  }
  return (await resposta.json()) as Record<string, unknown>;
}

export const provedorOrs: ProvedorRotas = {
  nome: "ors",

  async matriz(origem, destinos) {
    if (destinos.length === 0) return [];

    const json = await postar(`/v2/matrix/${PERFIL}`, {
      locations: [origem, ...destinos].map(paraLngLat),
      sources: [0],
      destinations: destinos.map((_, i) => i + 1),
      metrics: ["distance", "duration"],
      units: "m",
    });

    const distancias = (json.distances as (number | null)[][] | undefined)?.[0] ?? [];
    const duracoes = (json.durations as (number | null)[][] | undefined)?.[0] ?? [];

    return destinos.map((_, i) => {
      const metros = distancias[i];
      const segundos = duracoes[i];
      if (metros == null) return { distanciaKm: null, duracaoMin: null, rotaEncontrada: false };
      return {
        distanciaKm: metros / 1000,
        duracaoMin: segundos == null ? null : Math.round(segundos / 60),
        rotaEncontrada: true,
      };
    }) satisfies ElementoMatrizRota[];
  },

  async tracado(pontos) {
    if (pontos.length < 2) return null;

    // A variante /geojson devolve o traçado como FeatureCollection, que é o
    // formato que o mapa consome direto (sem decodificar polyline).
    const json = await postar(`/v2/directions/${PERFIL}/geojson`, {
      coordinates: pontos.map(paraLngLat),
    });

    const feature = (
      json.features as
        | {
            geometry?: { coordinates?: [number, number][] };
            properties?: {
              summary?: { distance?: number; duration?: number };
              segments?: { distance?: number; duration?: number }[];
            };
          }[]
        | undefined
    )?.[0];

    const coordenadas = feature?.geometry?.coordinates;
    if (!coordenadas?.length) return null;

    const resumo = feature?.properties?.summary ?? {};
    return {
      geometria: coordenadas.map(deLngLat),
      distanciaKm: (resumo.distance ?? 0) / 1000,
      duracaoMin: Math.round((resumo.duration ?? 0) / 60),
      // ORS chama de "segments"; um por par de pontos consecutivos.
      pernas: (feature?.properties?.segments ?? []).map((seg) => ({
        distanciaKm: (seg.distance ?? 0) / 1000,
        duracaoMin: Math.round((seg.duration ?? 0) / 60),
      })),
    } satisfies TracadoRota;
  },
};
