export type PontoGeografico = { lat: number; lng: number };

// Espelha fn_haversine_km (supabase/migrations/0001_init_schema.sql) —
// mesma fórmula, mas em JS porque aqui precisamos varrer todas as RTs em
// memória (já carregadas do Supabase) pra fazer o primeiro filtro barato
// antes de consultar a Routes API do Google (item 18 do spec: reduzir
// candidatas com cálculo próprio antes da chamada paga).
export function haversineKm(a: PontoGeografico, b: PontoGeografico): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

// Ordena por proximidade (Haversine) a um ponto de referência e devolve só
// as N mais próximas — não filtra por raio fixo: se a região for esparsa,
// ainda queremos mostrar as melhores opções disponíveis (mesmo que fiquem
// rotuladas "alto deslocamento" depois). O raio configurável entra na
// pontuação/rotulagem, não como corte rígido de candidatas.
export function maisProximas<T extends PontoGeografico>(
  referencia: PontoGeografico,
  pontos: T[],
  limite: number,
): (T & { distanciaAprox: number })[] {
  return pontos
    .map((p) => ({ ...p, distanciaAprox: haversineKm(referencia, p) }))
    .sort((a, b) => a.distanciaAprox - b.distanciaAprox)
    .slice(0, limite);
}
