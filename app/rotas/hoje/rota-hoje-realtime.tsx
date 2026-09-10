"use client";

import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";

// A tela "Rota do dia" reflete duas coisas ao vivo:
//   - progresso das paradas: INSERT/UPDATE em `servicos` (Realtime desde a 0019)
//   - posição dos técnicos: INSERT em `tecnico_posicao` (Realtime na 0038)
// Qualquer um dos dois refaz o fetch do Server Component.
export function RotaHojeRealtime() {
  useRealtimeRefresh("rota-hoje", [
    { tabela: "servicos" },
    { tabela: "tecnico_posicao", evento: "INSERT" },
  ]);

  return null;
}
