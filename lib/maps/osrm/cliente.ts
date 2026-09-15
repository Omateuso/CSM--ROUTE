import { criarLimitador } from "@/lib/limitador";
import type { PontoGeografico } from "@/lib/routing/proximity";
import {
  deLngLat,
  paraLngLat,
  type ElementoMatrizRota,
  type ProvedorRotas,
  type TracadoRota,
} from "../tipos";

// Adaptador OSRM (Open Source Routing Machine).
//
// Formato confirmado empiricamente contra um servidor real em 10/09/2026,
// não de memória:
//   table/v1/driving/{lng,lat};...?sources=0&destinations=1;2&annotations=distance,duration
//     -> { code:"Ok", distances:[[metros,...]], durations:[[segundos,...]] }
//   route/v1/driving/{lng,lat};...?overview=full&geometries=geojson
//     -> { code:"Ok", routes:[{ distance, duration, geometry:{coordinates:[[lng,lat],...]} }] }
//
// ATENÇÃO ao servidor público (router.project-osrm.org): a política oficial
// é 1 req/s, sem garantia de disponibilidade, e uso em produção é vedado.
// Ele serve pra teste; em produção este adaptador aponta pra um OSRM
// próprio via OSRM_BASE_URL (é o destino no servidor interno).

const OSRM_PADRAO = "https://router.project-osrm.org";

// 1 req/s é o teto do servidor público. Num OSRM próprio isso é irrelevante
// (ninguém limita a si mesmo), mas o valor conservador não atrapalha: o
// volume daqui é de dezenas de chamadas por dia.
const limitador = criarLimitador(1);

function baseUrl(): string {
  return (process.env.OSRM_BASE_URL || OSRM_PADRAO).replace(/\/+$/, "");
}

function coordenadas(pontos: PontoGeografico[]): string {
  return pontos.map((p) => paraLngLat(p).join(",")).join(";");
}

async function buscarJson(url: string): Promise<Record<string, unknown>> {
  await limitador.aguardarVez();
  const resposta = await fetch(url, { headers: { "User-Agent": "CSM-ROUTE/1.0 (gestao operacional RTs)" } });
  if (!resposta.ok) {
    throw new Error(`OSRM respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`);
  }
  const json = (await resposta.json()) as Record<string, unknown>;
  if (json.code !== "Ok") {
    throw new Error(`OSRM devolveu code=${String(json.code)}: ${String(json.message ?? "")}`);
  }
  return json;
}

export const provedorOsrm: ProvedorRotas = {
  nome: "osrm",

  async matriz(origem, destinos) {
    if (destinos.length === 0) return [];

    // `destinations` explícito (1..n) — sem isso o índice 0 é a própria
    // origem e as colunas saem deslocadas em relação a `destinos`.
    const indices = destinos.map((_, i) => i + 1).join(";");
    const url =
      `${baseUrl()}/table/v1/driving/${coordenadas([origem, ...destinos])}` +
      `?sources=0&destinations=${indices}&annotations=distance,duration`;

    const json = await buscarJson(url);
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

  async matrizCompleta(pontos) {
    if (pontos.length === 0) return [];
    if (pontos.length === 1) return [[{ distanciaKm: 0, duracaoMin: 0, rotaEncontrada: true }]];

    // Sem `sources`/`destinations`, o `/table` do OSRM já devolve a matriz
    // completa (todos os pontos como origem E destino).
    const url = `${baseUrl()}/table/v1/driving/${coordenadas(pontos)}?annotations=distance,duration`;

    const json = await buscarJson(url);
    const distancias = (json.distances as (number | null)[][] | undefined) ?? [];
    const duracoes = (json.durations as (number | null)[][] | undefined) ?? [];

    return pontos.map((_, i) =>
      pontos.map((_, j) => {
        const metros = distancias[i]?.[j];
        const segundos = duracoes[i]?.[j];
        if (metros == null) return { distanciaKm: null, duracaoMin: null, rotaEncontrada: false };
        return {
          distanciaKm: metros / 1000,
          duracaoMin: segundos == null ? null : Math.round(segundos / 60),
          rotaEncontrada: true,
        };
      }),
    ) satisfies ElementoMatrizRota[][];
  },

  async tracado(pontos) {
    if (pontos.length < 2) return null;
    const url =
      `${baseUrl()}/route/v1/driving/${coordenadas(pontos)}` +
      `?overview=full&geometries=geojson`;

    const json = await buscarJson(url);
    const rota = (
      json.routes as
        | {
            distance?: number;
            duration?: number;
            geometry?: { coordinates?: [number, number][] };
            legs?: { distance?: number; duration?: number }[];
          }[]
        | undefined
    )?.[0];
    if (!rota?.geometry?.coordinates?.length) return null;

    return {
      geometria: rota.geometry.coordinates.map(deLngLat),
      distanciaKm: (rota.distance ?? 0) / 1000,
      duracaoMin: Math.round((rota.duration ?? 0) / 60),
      // OSRM chama de "legs"; um por par de pontos consecutivos.
      pernas: (rota.legs ?? []).map((l) => ({
        distanciaKm: (l.distance ?? 0) / 1000,
        duracaoMin: Math.round((l.duration ?? 0) / 60),
      })),
    } satisfies TracadoRota;
  },
};
