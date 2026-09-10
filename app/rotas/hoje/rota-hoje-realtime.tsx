"use client";

import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";

// A tela "Rota do dia" reflete o progresso das paradas ao vivo: qualquer
// INSERT/UPDATE em `servicos` (Realtime desde a 0019) refaz o fetch do
// Server Component — é o que faz "Atendimento em andamento" aparecer no
// instante em que o técnico aperta "Iniciar".
//
// A assinatura de `tecnico_posicao` saiu com o rastreamento (0041).
export function RotaHojeRealtime() {
  useRealtimeRefresh("rota-hoje", [{ tabela: "servicos" }]);

  return null;
}
