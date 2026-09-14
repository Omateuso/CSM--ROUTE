"use client";

import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";

// Sem F5 (pedido do usuário, 14/09/2026) — decisão anterior (19/08/2026)
// tinha sido não usar Realtime aqui, oferecido e recusado na época; o
// usuário pediu de novo agora, dessa vez pra todo o produto. `chamados`
// (novo trazido pela sync, status mudou), `servicos` (execução/validação)
// e `rotas` (rota confirmada/cancelada) cobrem as seções desta tela.
export function PainelRealtime() {
  const conectado = useRealtimeRefresh("painel-gestao", [
    { tabela: "chamados" },
    { tabela: "servicos" },
    { tabela: "rotas" },
  ]);

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
