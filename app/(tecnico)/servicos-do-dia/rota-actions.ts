"use server";

import { otimizarOrdemVisita, type ResultadoOtimizacao } from "@/lib/routing/otimizar-visita";
import type { PontoGeografico } from "@/lib/routing/proximity";
import type { EnderecoNavegacao } from "@/lib/navegacao";

// Rota otimizada por tempo a partir de onde o técnico está (pedido do
// usuário, 15/09/2026) — a chave do provedor de rotas (ORS/OSRM) é
// server-only, então essa conta não pode rodar no client; a página chama
// isso direto (sem passar por <form action>), mesmo padrão já usado por
// `marcarRespostasVistas` em app/chamados/actions.ts.
// A coordenada decide a ORDEM (é o que a matriz de distância entende); o
// endereço viaja junto porque é ele que vai no link final de navegação —
// mandar coordenada pro Google faz ele mostrar o endereço mais próximo do
// ponto, não o nosso (ver lib/navegacao.ts).
export type ParadaParaOtimizar = PontoGeografico & { codigo: string; endereco: EnderecoNavegacao };

export async function otimizarRotaDoDia(
  origem: PontoGeografico,
  paradas: ParadaParaOtimizar[],
): Promise<ResultadoOtimizacao<ParadaParaOtimizar>> {
  return otimizarOrdemVisita(origem, paradas);
}
