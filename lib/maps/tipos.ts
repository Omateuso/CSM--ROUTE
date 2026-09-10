import type { PontoGeografico } from "@/lib/routing/proximity";

// Contrato do provedor de rotas. Existe pra que trocar de serviço seja
// trocar de adaptador, não caçar chamada espalhada pelo código: hoje é o
// OpenRouteService (chave gratuita), amanhã é um OSRM próprio dentro do
// servidor interno — ver docs/migracao-servidor-interno.md.
//
// Convenção de coordenada: a interface fala em { lat, lng } (o que o resto
// do projeto usa). ORS e OSRM esperam [longitude, latitude] — a inversão
// fica DENTRO de cada adaptador, nunca vaza pra cá. Foi a pegadinha mais
// provável desta camada, então está isolada num lugar só.

export type ElementoMatrizRota = {
  distanciaKm: number | null;
  duracaoMin: number | null;
  rotaEncontrada: boolean;
};

/** Um trecho entre dois pontos consecutivos do percurso. */
export type PernaRota = {
  distanciaKm: number;
  duracaoMin: number;
};

export type TracadoRota = {
  /** Pontos do traçado de rua na ordem do percurso, em { lat, lng }. */
  geometria: PontoGeografico[];
  distanciaKm: number;
  duracaoMin: number;
  /**
   * Um item por trecho entre pontos consecutivos. É o que dá o tempo até a
   * PRÓXIMA parada sem uma segunda chamada ao provedor — `pernas[0]` é o
   * caminho da posição atual do técnico até a parada seguinte.
   */
  pernas: PernaRota[];
};

export interface ProvedorRotas {
  nome: string;
  /** Distância/duração de carro de UMA origem pra vários destinos, na mesma ordem de `destinos`. */
  matriz(origem: PontoGeografico, destinos: PontoGeografico[]): Promise<ElementoMatrizRota[]>;
  /** Traçado de rua passando pelos pontos na ordem dada. `null` quando não há rota. */
  tracado(pontos: PontoGeografico[]): Promise<TracadoRota | null>;
}

/** ORS e OSRM usam [lng, lat] — o contrário de quase todo o resto. */
export function paraLngLat(p: PontoGeografico): [number, number] {
  return [p.lng, p.lat];
}

export function deLngLat([lng, lat]: [number, number]): PontoGeografico {
  return { lat, lng };
}
