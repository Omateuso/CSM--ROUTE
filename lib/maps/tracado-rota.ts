import { obterProvedor } from "./provedor";
import type { TracadoRota } from "./tipos";
import type { PontoGeografico } from "@/lib/routing/proximity";

// Traçado de rua de uma rota confirmada, com cache em memória.
//
// O cache não é otimização prematura: a tela "Rota do dia" refaz o fetch do
// Server Component a cada evento de Realtime — e um evento desses é cada
// ping de GPS do técnico (a cada 30s, por técnico). Sem cache, um dia de
// operação com 3 técnicos torraria a cota diária do ORS só redesenhando a
// mesma linha.
//
// A chave é a própria sequência de coordenadas: rota confirmada é histórico
// imutável (as paradas nunca mudam depois de confirmada — ver 0011/0031),
// então o traçado de uma dada sequência é estável. Duas rotas com as mesmas
// paradas compartilham o resultado de graça.

const SUCESSO = new Map<string, TracadoRota>();
const FALHA = new Map<string, number>();

// Sucesso vale pra sempre (a geometria não muda). Falha vale pouco: uma
// indisponibilidade passageira do provedor não pode desligar o traçado até
// o servidor reiniciar.
const FALHA_TTL_MS = 5 * 60_000;
const MAX_ENTRADAS = 200;

function chaveDe(pontos: PontoGeografico[]): string {
  return pontos.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");
}

export async function tracadoDaRota(pontos: PontoGeografico[]): Promise<TracadoRota | null> {
  if (pontos.length < 2) return null;

  const chave = chaveDe(pontos);
  const guardado = SUCESSO.get(chave);
  if (guardado) return guardado;

  const falhouEm = FALHA.get(chave);
  if (falhouEm && Date.now() - falhouEm < FALHA_TTL_MS) return null;

  try {
    const tracado = await obterProvedor().tracado(pontos);
    if (!tracado) {
      FALHA.set(chave, Date.now());
      return null;
    }
    if (SUCESSO.size >= MAX_ENTRADAS) SUCESSO.clear();
    SUCESSO.set(chave, tracado);
    FALHA.delete(chave);
    return tracado;
  } catch (err) {
    // Mesma postura do resto do projeto: provedor fora do ar degrada a tela
    // (some a linha planejada), nunca derruba.
    console.warn("Traçado de rota indisponível:", err);
    FALHA.set(chave, Date.now());
    return null;
  }
}
