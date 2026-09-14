"use client";

import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";

// Mudança em qualquer `servico` (rota nova confirmada, chamado que chegou
// depois via fn_atualizar_servicos_rota, gerente reagendando/trocando
// técnico, urgência despachada) refaz o fetch da lista — sem F5 (pedido do
// usuário, 14/09/2026). Mesma mecânica de app/(gerente)/dashboard —
// lib/realtime/ desde 10/09/2026, RLS de `servicos_select` (0001) já
// garante que o técnico só recebe evento do próprio serviço.
//
// Bônus real: isso também é a correção mais robusta pro relato "concluí um
// chamado, voltei pra tela inicial, os concluídos voltaram" — não importa
// a causa exata (cache do roteador, prefetch antigo, o que for),
// `router.refresh()` sempre busca a lista de novo no servidor a partir do
// zero, ignorando qualquer versão antiga que o navegador tivesse guardada.
export function ServicosRealtime() {
  const conectado = useRealtimeRefresh("servicos-do-dia", [{ tabela: "servicos" }]);

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-text-tertiary" role="status">
      <span
        className={`h-1.5 w-1.5 rounded-full ${conectado ? "bg-sla-dentro" : "border border-text-tertiary"}`}
        aria-hidden="true"
      />
      {conectado ? "Ao vivo" : "Conectando..."}
    </span>
  );
}
