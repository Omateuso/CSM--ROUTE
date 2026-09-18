"use client";

import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";
import { IndicadorAoVivo } from "@/lib/ui/indicador-ao-vivo";

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
    <IndicadorAoVivo conectado={conectado} />
  );
}
