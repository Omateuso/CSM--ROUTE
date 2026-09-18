"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adaptadorRealtime } from "./index";
import type { AlvoRealtime } from "./tipos";

// Hook que as telas usam: assina as tabelas e refaz o fetch do Server
// Component a cada mudança. `router.refresh()` preserva scroll e estado do
// client — quem garante isso é o Next, não precisamos rebuscar nada aqui.
//
// Devolve o estado da conexão pro indicador "Atualizado" do dashboard.
export function useRealtimeRefresh(canal: string, alvos: readonly AlvoRealtime[]): boolean {
  const router = useRouter();
  const [conectado, setConectado] = useState(false);

  // Serializa os alvos: o array literal muda de identidade a cada render e
  // reassinaria o canal sem parar.
  const chaveAlvos = alvos.map((a) => `${a.tabela}:${a.evento ?? "*"}`).join(",");

  useEffect(() => {
    const assinatura = adaptadorRealtime().assinar({
      canal,
      alvos: chaveAlvos.split(",").map((par) => {
        const [tabela, evento] = par.split(":");
        return { tabela, evento: evento as AlvoRealtime["evento"] };
      }),
      aoMudar: () => router.refresh(),
      aoConectar: setConectado,
    });
    return () => assinatura.encerrar();
  }, [router, canal, chaveAlvos]);

  return conectado;
}
