"use server";

import { otimizarOrdemVisita } from "@/lib/routing/otimizar-visita";
import type { PontoGeografico } from "@/lib/routing/proximity";

// Rota otimizada por tempo a partir de onde o técnico está (pedido do
// usuário, 15/09/2026) — a chave do provedor de rotas (ORS/OSRM) é
// server-only, então essa conta não pode rodar no client; a página chama
// isso direto (sem passar por <form action>), mesmo padrão já usado por
// `marcarRespostasVistas` em app/chamados/actions.ts.
export type ParadaParaOtimizar = PontoGeografico & { codigo: string };

export async function otimizarRotaDoDia(
  origem: PontoGeografico,
  paradas: ParadaParaOtimizar[],
): Promise<ParadaParaOtimizar[]> {
  return otimizarOrdemVisita(origem, paradas);
}
