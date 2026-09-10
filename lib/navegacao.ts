import type { PontoGeografico } from "@/lib/routing/proximity";

// Navegação do técnico: abre a rota no app de mapa DELE (Google Maps ou
// Waze), em vez de embutir turn-by-turn no PWA.
//
// Por quê: são URLs universais — no celular abrem o app nativo, no desktop
// o site. Não custam requisição de API nenhuma, não gastam cota do provedor
// de rotas, e entregam navegação de verdade (voz, trânsito, recálculo) com
// o app que o técnico já conhece. Reimplementar isso dentro do PWA seria
// pior e mais caro.
//
// Referência: Google Maps URLs (api=1). Waze só aceita um destino, então
// serve pra "ir para esta RT", nunca pra rota do dia inteira.

/** O Maps URLs API aceita no máximo 9 pontos intermediários. */
const MAX_WAYPOINTS = 9;

function coord(p: PontoGeografico): string {
  return `${p.lat},${p.lng}`;
}

/** Navegação até um ponto único, saindo de onde o técnico estiver. */
export function linkGoogleMapsDestino(destino: PontoGeografico): string {
  const q = new URLSearchParams({
    api: "1",
    destination: coord(destino),
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${q}`;
}

export function linkWaze(destino: PontoGeografico): string {
  return `https://waze.com/ul?ll=${coord(destino)}&navigate=yes`;
}

export type RotaNavegacao = {
  /** Quantas paradas o link realmente cobre (o Google corta em 9 intermediárias). */
  paradasNoLink: number;
  truncada: boolean;
  url: string;
};

/**
 * Rota do dia inteira no Google Maps: a origem fica em aberto (o app usa a
 * posição atual do técnico), as paradas intermediárias viram `waypoints` na
 * ordem da rota, e a última vira o destino.
 */
export function linkGoogleMapsRota(paradas: PontoGeografico[]): RotaNavegacao | null {
  if (paradas.length === 0) return null;

  const destino = paradas[paradas.length - 1];
  const intermediarias = paradas.slice(0, -1);
  const truncada = intermediarias.length > MAX_WAYPOINTS;
  // Corta as ÚLTIMAS intermediárias, não as primeiras: o técnico começa
  // pelo início da rota, então é o começo que precisa estar no link.
  const usadas = truncada ? intermediarias.slice(0, MAX_WAYPOINTS) : intermediarias;

  const q = new URLSearchParams({ api: "1", destination: coord(destino), travelmode: "driving" });
  if (usadas.length > 0) q.set("waypoints", usadas.map(coord).join("|"));

  return {
    url: `https://www.google.com/maps/dir/?${q}`,
    paradasNoLink: usadas.length + 1,
    truncada,
  };
}

/** Filtra paradas sem coordenada e remove repetição consecutiva do mesmo ponto. */
export function paradasNavegaveis<T extends { lat: number | null; lng: number | null }>(
  paradas: T[],
): PontoGeografico[] {
  const pontos: PontoGeografico[] = [];
  for (const p of paradas) {
    if (p.lat == null || p.lng == null) continue;
    const anterior = pontos[pontos.length - 1];
    // Várias RTs do mesmo condomínio caem na mesma coordenada (achado real
    // do projeto: SRT 11 e SRT 86). Repetir o ponto no link só faz o Google
    // desenhar uma parada inútil.
    if (anterior && anterior.lat === p.lat && anterior.lng === p.lng) continue;
    pontos.push({ lat: p.lat, lng: p.lng });
  }
  return pontos;
}
