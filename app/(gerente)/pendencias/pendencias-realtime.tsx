"use client";

import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";

// Sem F5 (pedido do usuário, 14/09/2026) — pendência nova (evento em
// `historico`) e o cancelamento do serviço que a acompanha (`servicos`).
export function PendenciasRealtime() {
  const conectado = useRealtimeRefresh("pendencias", [{ tabela: "historico" }, { tabela: "servicos" }]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary" role="status">
      <span
        className={`h-1.5 w-1.5 rounded-full ${conectado ? "bg-sla-dentro" : "border border-text-tertiary"}`}
        aria-hidden="true"
      />
      {conectado ? "Ao vivo" : "Conectando..."}
    </span>
  );
}
