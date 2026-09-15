import { obterProvedor } from "@/lib/maps/provedor";
import type { ElementoMatrizRota } from "@/lib/maps/provedor";
import { haversineKm, type PontoGeografico } from "./proximity";

// Otimização de ordem de visita pra "Abrir rota no Google Maps" (pedido do
// usuário, 15/09/2026: "fazer a melhor rota e ordem das rts a partir do
// lugar que o técnico está no início"). Problema diferente do que
// `intelligent-route.ts` resolve — lá é "qual RT sugerir agora, entre um
// pool grande, pesando chamados/prioridade/SLA junto com distância"; aqui é
// "dado um conjunto FIXO e pequeno de paradas já confirmadas pro dia
// (a gerência já decidiu quais RTs), qual ordem minimiza o tempo total de
// deslocamento a partir de onde o técnico está agora". Puramente geográfico,
// sem pontuação operacional — o Google Maps não reordena waypoints sozinho
// (a API de URL só visita na ordem dada), então a ordem já precisa sair
// certa daqui.
//
// Nearest-neighbor guloso (não TSP exato — mesma filosofia de aproximação
// que o resto do projeto já usa pra roteirização): a cada passo, escolhe a
// parada restante mais perto (tempo, ou distância se o provedor não tiver
// tempo) do ponto atual. Pra N pequeno (o dia de um técnico raramente passa
// de ~9 paradas, teto do próprio link do Google Maps) isso já dá uma ordem
// muito boa sem o custo combinatório de um TSP exato.

/** Ordena `pontos[1..]` a partir de `pontos[0]` (a origem), usando a matriz
 * completa já calculada. Pura — sem I/O, fácil de testar. `indices` guarda
 * a posição original em `pontos` de cada parada (pra reconstruir o payload
 * completo depois, não só a coordenada). */
function ordenarPorMatriz(matriz: ElementoMatrizRota[][] | null, pontos: PontoGeografico[]): number[] {
  const restantes = pontos.map((_, i) => i).slice(1); // índice 0 é sempre a origem
  const ordem: number[] = [];
  let atual = 0;

  while (restantes.length > 0) {
    let melhorPos = 0;
    let melhorCusto = Infinity;
    restantes.forEach((idx, pos) => {
      const m = matriz?.[atual]?.[idx];
      // Prefere tempo (o pedido é "otimização de tempo"); cai pra distância
      // do provedor, e por fim Haversine — nunca deixa uma parada sem
      // custo nenhum pra comparar. Dentro de UM passo, todos os candidatos
      // vêm da MESMA linha da matriz (mesma chamada ao provedor), então a
      // base de comparação é sempre consistente entre eles.
      const custo = m?.duracaoMin ?? m?.distanciaKm ?? haversineKm(pontos[atual], pontos[idx]);
      if (custo < melhorCusto) {
        melhorCusto = custo;
        melhorPos = pos;
      }
    });
    const [escolhido] = restantes.splice(melhorPos, 1);
    ordem.push(escolhido);
    atual = escolhido;
  }
  return ordem;
}

export type ResultadoOtimizacao<T> = {
  paradas: T[];
  /** "provedor": tempo/distância de rua real (ORS/OSRM). "linha_reta":
   * o provedor falhou ou não está configurado — a ordem ainda foi
   * recalculada a partir da posição do técnico, só que por distância em
   * linha reta (Haversine), não por rua/tempo real. Quem chama usa isso
   * pra avisar o técnico do que realmente aconteceu, em vez de um sucesso
   * silencioso indistinguível de uma falha silenciosa (achado real,
   * 15/09/2026: sem esse retorno, um provedor fora do ar parecia
   * "a otimização não funciona"). */
  fonte: "provedor" | "linha_reta";
};

/**
 * Reordena `paradas` pra minimizar o deslocamento total a partir de
 * `origem` (a posição atual do técnico). Degrada pra Haversine se o
 * provedor de rotas falhar ou não estiver configurado — nunca trava o
 * técnico esperando uma API externa responder; na pior das hipóteses, a
 * ordem fica só "boa" (linha reta) em vez de "ótima" (rua real).
 */
export async function otimizarOrdemVisita<T extends PontoGeografico>(
  origem: PontoGeografico,
  paradas: T[],
): Promise<ResultadoOtimizacao<T>> {
  if (paradas.length <= 1) return { paradas, fonte: "provedor" };

  const pontos: PontoGeografico[] = [origem, ...paradas];
  let matriz: ElementoMatrizRota[][] | null = null;
  let fonte: ResultadoOtimizacao<T>["fonte"] = "provedor";
  try {
    matriz = await obterProvedor().matrizCompleta(pontos);
  } catch (err) {
    fonte = "linha_reta";
    console.warn("Provedor de rotas indisponível pra otimizar a ordem de visita — caindo pra linha reta:", err);
  }

  const ordem = ordenarPorMatriz(matriz, pontos);
  return { paradas: ordem.map((indice) => paradas[indice - 1]), fonte }; // -1: desfaz o deslocamento de índice da origem
}
