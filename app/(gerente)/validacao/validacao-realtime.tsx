"use client";

import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";
import { IndicadorAoVivo } from "@/lib/ui/indicador-ao-vivo";

// Sem F5 (pedido do usuário, 14/09/2026): `servicos` cobre concluído/
// travado/validado; `historico` cobre apontamento do técnico
// (`servico_avaliado` não mexe em `servicos`, só grava evento — migration
// 0048 é o que deixa esse evento chegar aqui).
export function ValidacaoRealtime() {
  const conectado = useRealtimeRefresh("validacao", [{ tabela: "servicos" }, { tabela: "historico" }]);

  return (
    <IndicadorAoVivo conectado={conectado} />
  );
}
