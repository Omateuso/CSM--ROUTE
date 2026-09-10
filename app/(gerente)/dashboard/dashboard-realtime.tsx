"use client";

import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";

// Primeira assinatura Realtime do projeto (Fase 4, Parte B) — qualquer
// INSERT/UPDATE em `servicos` (rota confirmada gerando serviço novo,
// técnico iniciando/concluindo, gerente validando/reagendando) refaz o
// fetch do Server Component. A RLS de `servicos_select` (0001) já garante
// que só chega evento de linha que o gerente logado poderia ver.
//
// A mecânica (canal, token no socket, reassinar no refresh de token) vive
// em lib/realtime/ desde 10/09/2026 — estava copiada em 3 telas, e o
// contrato agora é o mesmo que um servidor interno com Socket.io teria de
// cumprir. Ver docs/migracao-servidor-interno.md.
export function DashboardRealtime() {
  const conectado = useRealtimeRefresh("dashboard-servicos", [{ tabela: "servicos" }]);

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
