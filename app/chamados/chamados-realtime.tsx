"use client";

import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";
import { IndicadorAoVivo } from "@/lib/ui/indicador-ao-vivo";

// Sem F5 (pedido do usuário, 14/09/2026) — chamado novo trazido pela
// sincronização automática (a cada 5 min, instrumentation.ts) ou status
// mudando (finalizado/cancelado no TomTicket) refaz a lista sozinho. O
// sino/toast de resposta de cliente (novas-respostas-toast.tsx, global) já
// cobre `chamado_respostas`; isso complementa com a tabela `chamados` em si.
export function ChamadosRealtime() {
  const conectado = useRealtimeRefresh("chamados-lista", [{ tabela: "chamados" }]);

  return (
    <IndicadorAoVivo conectado={conectado} />
  );
}
