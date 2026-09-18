"use client";

import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";

// Sem indicador visual (diferente de servicos-do-dia/servicos-realtime.tsx)
// — essa tela já é densa (foto, descrição, formulário), um "Atualizado" a mais
// não ajuda o técnico em campo. Só o efeito: se o gerente solicitar
// correção ou mexer no serviço enquanto o técnico está com o detalhe
// aberto, a tela se atualiza sozinha.
export function ServicoRealtime() {
  useRealtimeRefresh("servico-detalhe", [{ tabela: "servicos" }]);
  return null;
}
