"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Primeira assinatura Realtime do projeto (Fase 4, Parte B) — qualquer
// INSERT/UPDATE em `servicos` (rota confirmada gerando serviço novo,
// técnico iniciando/concluindo, gerente validando/reagendando) dispara um
// `router.refresh()`, que refaz o fetch do Server Component sem perder
// scroll/estado do client (é o próprio Next quem garante isso, não
// precisamos re-buscar os dados aqui). RLS de `servicos_select` (0001) já
// garante que só chega evento de linha que o gerente logado teria
// permissão de ver — nada de filtro adicional aqui.
//
// Achado depurando (19/08/2026): o client do `@supabase/ssr` não garante
// que o token da sessão já esteja setado no socket de Realtime no exato
// momento em que o canal assina — sem isso, a assinatura chega a
// "SUBSCRIBED" mas a checagem de RLS por trás do postgres_changes falha
// silenciosamente (evento nunca chega, sem erro nenhum). Confirmado com um
// script isolado: chamando `supabase.realtime.setAuth(token)` antes do
// `.subscribe()`, o evento chega certinho. Reassina no auth change também,
// pra sobreviver a um refresh de token durante uma sessão longa no painel.
export function DashboardRealtime() {
  const router = useRouter();
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;

    async function assinar() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) await supabase.realtime.setAuth(session.access_token);
      if (cancelado) return;

      canal = supabase
        .channel("dashboard-servicos")
        .on("postgres_changes", { event: "*", schema: "public", table: "servicos" }, () => {
          router.refresh();
        })
        .subscribe((status) => setConectado(status === "SUBSCRIBED"));
    }

    assinar();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      cancelado = true;
      subscription.unsubscribe();
      if (canal) supabase.removeChannel(canal);
    };
  }, [router]);

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
