import { SCORE_WEIGHTS } from "./config";

export type FatoresOperacionais = {
  totalAbertos: number;
  emergenciais: number;
  altas: number;
  vencidos: number;
  proximos: number;
};

// Parte da pontuação que não depende de deslocamento — volume, prioridade
// e SLA (item 9 do spec). Reaproveitada tanto na primeira escolha (sem
// referência geográfica ainda) quanto nas escolhas seguintes.
function pontosOperacionais(f: FatoresOperacionais): number {
  const w = SCORE_WEIGHTS;
  return (
    f.totalAbertos * w.porChamadoAberto +
    f.altas * w.porAlta +
    f.emergenciais * w.porEmergencial +
    f.proximos * w.porSlaProximo +
    f.vencidos * w.porSlaVencido
  );
}

// Pontuação pra primeira RT da rota — ainda não existe "última RT
// selecionada", então não há deslocamento pra pontuar (item 6: ordenar por
// relevância operacional).
export function calcularScoreInicial(f: FatoresOperacionais): number {
  return pontosOperacionais(f);
}

// Pontuação completa — usada a partir da segunda RT em diante, quando já
// existe uma RT de referência com distância/tempo reais calculados.
export function calcularScoreComDeslocamento(
  f: FatoresOperacionais & { distanciaKm: number; duracaoMin: number; tamanhoNucleo: number },
): number {
  const w = SCORE_WEIGHTS;
  return (
    w.proximidadeBase / (1 + f.distanciaKm) +
    w.tempoBase / (1 + f.duracaoMin / 10) +
    f.tamanhoNucleo * w.porRtNoNucleo +
    pontosOperacionais(f)
  );
}

// Explicação textual (item 10 do spec — nunca só "RT C recomendada", tem
// que dizer o motivo). Sempre a partir dos mesmos números usados na
// pontuação, nunca um texto genérico solto.
export function gerarMotivo(
  f: FatoresOperacionais & { distanciaKm?: number; duracaoMin?: number },
): string {
  const partes: string[] = [];
  if (typeof f.distanciaKm === "number") {
    partes.push(`${f.distanciaKm.toFixed(1)} km da última RT`);
  }
  if (typeof f.duracaoMin === "number" && f.duracaoMin > 0) {
    partes.push(`~${f.duracaoMin} min de carro`);
  }
  partes.push(`${f.totalAbertos} chamado${f.totalAbertos === 1 ? "" : "s"} em aberto`);
  if (f.emergenciais > 0) {
    partes.push(`${f.emergenciais} ${f.emergenciais === 1 ? "emergencial" : "emergenciais"}`);
  }
  if (f.altas > 0) {
    partes.push(`${f.altas} de prioridade alta`);
  }
  if (f.vencidos > 0) {
    partes.push(`${f.vencidos} com SLA vencido`);
  }
  return partes.join(", ");
}
