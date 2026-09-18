"use client";

import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";
import { IndicadorAoVivo } from "@/lib/ui/indicador-ao-vivo";

// Sem F5 (pedido do usuário, 14/09/2026) — pendência nova (evento em
// `historico`) e o cancelamento do serviço que a acompanha (`servicos`).
export function PendenciasRealtime() {
  const conectado = useRealtimeRefresh("pendencias", [{ tabela: "historico" }, { tabela: "servicos" }]);

  return (
    <IndicadorAoVivo conectado={conectado} />
  );
}
