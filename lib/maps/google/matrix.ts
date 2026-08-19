// Integração com a Routes API (computeRouteMatrix) do Google Maps
// Platform — só roda no servidor (nunca no client): a REST API de Routes
// não libera CORS pra fetch direto do browser (CF1 da skill
// google-maps-platform), então isso só pode ser chamado de dentro de uma
// API route / server action.
//
// Chave: reaproveita NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (a mesma Demo Key já
// usada no mapa client-side) — decisão do usuário em 16/08/2026 enquanto
// o projeto está em modo prototipagem. Antes de produção, trocar por uma
// chave server-only separada, restrita por IP no Google Cloud Console
// (ver CLAUDE.md / plano-de-fases.md, "Setup específico da Fase 2").
import type { PontoGeografico } from "@/lib/routing/proximity";

export type ElementoMatrizRota = {
  distanciaKm: number | null;
  duracaoMin: number | null;
  rotaEncontrada: boolean;
};

type LinhaRespostaMatriz = {
  originIndex?: number;
  destinationIndex?: number;
  distanceMeters?: number;
  duration?: string;
  condition?: "ROUTE_EXISTS" | "ROUTE_NOT_FOUND";
};

// distância/duração de carro de UM ponto de origem pra vários destinos —
// exatamente o formato que a sugestão de rota precisa (última RT
// selecionada -> candidatas). Devolve na mesma ordem de `destinos`.
export async function calcularMatrizDistancia(
  origem: PontoGeografico,
  destinos: PontoGeografico[],
): Promise<ElementoMatrizRota[]> {
  if (destinos.length === 0) return [];

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY não configurada no servidor.");
  }

  const resposta = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,duration,condition",
      "X-Goog-Maps-Solution-ID": "gmp_git_agentskills_v1",
    },
    body: JSON.stringify({
      origins: [
        { waypoint: { location: { latLng: { latitude: origem.lat, longitude: origem.lng } } } },
      ],
      destinations: destinos.map((d) => ({
        waypoint: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
      })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
    }),
  });

  if (!resposta.ok) {
    throw new Error(`Routes API respondeu ${resposta.status}: ${await resposta.text()}`);
  }

  const linhas: LinhaRespostaMatriz[] = await resposta.json();

  return destinos.map((_, indice) => {
    const linha = linhas.find((l) => (l.destinationIndex ?? 0) === indice);
    if (!linha || linha.condition !== "ROUTE_EXISTS") {
      return { distanciaKm: null, duracaoMin: null, rotaEncontrada: false };
    }
    // duration vem como string tipo "160s" — parseInt já para no "s".
    const duracaoSegundos = parseInt(linha.duration ?? "0", 10);
    return {
      distanciaKm: (linha.distanceMeters ?? 0) / 1000,
      duracaoMin: Math.round(duracaoSegundos / 60),
      rotaEncontrada: true,
    };
  });
}
