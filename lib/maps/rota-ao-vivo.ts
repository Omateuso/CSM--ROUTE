import { obterProvedor } from "./provedor";
import type { PontoGeografico } from "@/lib/routing/proximity";

// Rota que o técnico está seguindo AGORA: da posição atual dele, passando
// pelas paradas que ainda faltam, na ordem da rota.
//
// É o mesmo caminho que o link "Abrir rota no Google Maps" abre no celular
// dele — só que desenhado no mapa do gerente/gestão, pra eles acompanharem
// sem depender de perguntar. Diferente do traçado planejado
// (lib/maps/tracado-rota.ts), que sai sempre da primeira parada e ignora
// onde o técnico está e o que já foi feito.
//
// `proxima` vem de `pernas[0]` — o trecho da posição atual até a parada
// seguinte. É o "tempo estimado de chegada na próxima RT", e sai da MESMA
// chamada que desenha a linha, sem custo extra.

export type RotaAoVivo = {
  geometria: PontoGeografico[];
  totalKm: number;
  totalMin: number;
  /** Trecho até a próxima parada. `null` se o provedor não devolveu pernas. */
  proxima: { distanciaKm: number; duracaoMin: number } | null;
};

// A posição muda a cada ping (30s por técnico) e a tela refaz o fetch a
// cada evento de Realtime — sem TTL, cada ping viraria uma chamada ao
// provedor. Com 3 min: no máximo 20 chamadas/hora por técnico, ~160 num
// turno de 8h. Cabe folgado nas 2.500/dia do plano gratuito do ORS.
//
// O arredondamento da posição (3 casas ≈ 110 m) ajuda no caso mais comum do
// dia: o técnico PARADO atendendo numa RT, quando pings sucessivos caem na
// mesma chave e nem chegam a consultar.
const TTL_MS = 3 * 60_000;
const TTL_FALHA_MS = 60_000;
const MAX_ENTRADAS = 300;

type Entrada = { em: number; valor: RotaAoVivo | null };
const cache = new Map<string, Entrada>();

function chaveDe(posicao: PontoGeografico, paradas: PontoGeografico[]): string {
  const p = `${posicao.lat.toFixed(3)},${posicao.lng.toFixed(3)}`;
  const destinos = paradas.map((d) => `${d.lat.toFixed(5)},${d.lng.toFixed(5)}`).join(";");
  return `${p}|${destinos}`;
}

export async function rotaAoVivo(
  posicao: PontoGeografico,
  paradasPendentes: PontoGeografico[],
): Promise<RotaAoVivo | null> {
  if (paradasPendentes.length === 0) return null;

  const chave = chaveDe(posicao, paradasPendentes);
  const guardado = cache.get(chave);
  if (guardado) {
    const ttl = guardado.valor ? TTL_MS : TTL_FALHA_MS;
    if (Date.now() - guardado.em < ttl) return guardado.valor;
  }

  let valor: RotaAoVivo | null = null;
  try {
    const tracado = await obterProvedor().tracado([posicao, ...paradasPendentes]);
    if (tracado) {
      valor = {
        geometria: tracado.geometria,
        totalKm: tracado.distanciaKm,
        totalMin: tracado.duracaoMin,
        proxima: tracado.pernas[0] ?? null,
      };
    }
  } catch (err) {
    // Mesma postura do resto do projeto: provedor fora do ar tira a linha e
    // o tempo estimado da tela, nunca derruba a tela.
    console.warn("Rota ao vivo indisponível:", err);
  }

  if (cache.size >= MAX_ENTRADAS) cache.clear();
  cache.set(chave, { em: Date.now(), valor });
  return valor;
}
