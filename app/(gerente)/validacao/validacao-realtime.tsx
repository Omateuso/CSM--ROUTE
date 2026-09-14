"use client";

import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";

// Sem F5 (pedido do usuário, 14/09/2026): `servicos` cobre concluído/
// travado/validado; `historico` cobre apontamento do técnico
// (`servico_avaliado` não mexe em `servicos`, só grava evento — migration
// 0048 é o que deixa esse evento chegar aqui).
export function ValidacaoRealtime() {
  const conectado = useRealtimeRefresh("validacao", [{ tabela: "servicos" }, { tabela: "historico" }]);

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
