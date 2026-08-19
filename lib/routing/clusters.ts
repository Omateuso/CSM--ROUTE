import { haversineKm, type PontoGeografico } from "./proximity";
import { NUCLEO_EPSILON_KM, NUCLEO_MIN_RTS } from "./config";

export type Nucleo = {
  rtIds: string[];
  totalChamados: number;
  raioKm: number;
};

type RtParaNucleo = PontoGeografico & { id: string; totalAbertos: number };

// Agrupa RTs "praticamente coladas" (item 11 do spec) via union-find sobre
// distância Haversine — duas RTs entram no mesmo grupo se a distância
// entre elas for <= NUCLEO_EPSILON_KM. Só vira núcleo de verdade (elegível
// pra sugestão de força-tarefa) com pelo menos NUCLEO_MIN_RTS no grupo.
export function detectarNucleos(rts: RtParaNucleo[]): Nucleo[] {
  const pai = new Map<string, string>();
  for (const rt of rts) pai.set(rt.id, rt.id);

  function encontrar(x: string): string {
    const p = pai.get(x)!;
    if (p !== x) {
      const raiz = encontrar(p);
      pai.set(x, raiz);
      return raiz;
    }
    return x;
  }

  function unir(a: string, b: string) {
    const ra = encontrar(a);
    const rb = encontrar(b);
    if (ra !== rb) pai.set(ra, rb);
  }

  for (let i = 0; i < rts.length; i++) {
    for (let j = i + 1; j < rts.length; j++) {
      if (haversineKm(rts[i], rts[j]) <= NUCLEO_EPSILON_KM) unir(rts[i].id, rts[j].id);
    }
  }

  const grupos = new Map<string, RtParaNucleo[]>();
  for (const rt of rts) {
    const raiz = encontrar(rt.id);
    const grupo = grupos.get(raiz) ?? [];
    grupo.push(rt);
    grupos.set(raiz, grupo);
  }

  return [...grupos.values()]
    .filter((g) => g.length >= NUCLEO_MIN_RTS)
    .map((g) => ({
      rtIds: g.map((r) => r.id),
      totalChamados: g.reduce((soma, r) => soma + r.totalAbertos, 0),
      raioKm: NUCLEO_EPSILON_KM,
    }));
}

// Entre vários núcleos detectados no mesmo lote, qual faz mais sentido
// sugerir agora — o maior em número de chamados.
export function maiorNucleo(nucleos: Nucleo[]): Nucleo | null {
  if (nucleos.length === 0) return null;
  return [...nucleos].sort((a, b) => b.totalChamados - a.totalChamados)[0];
}
