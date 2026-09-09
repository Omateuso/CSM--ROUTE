"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Fase 5 — a tela "Rota do dia" reflete duas coisas ao vivo:
//   - progresso das paradas: INSERT/UPDATE em `servicos` (Realtime desde a 0019)
//   - posição dos técnicos: INSERT em `tecnico_posicao` (Realtime na 0038)
// Qualquer um dos dois dispara `router.refresh()`, que refaz o fetch do
// Server Component sem perder scroll/estado (o Next cuida disso).
//
// Mesmo detalhe de `dashboard-realtime.tsx`: o client do @supabase/ssr não
// garante o token no socket no momento do subscribe — sem `setAuth` antes,
// a assinatura chega a SUBSCRIBED mas a RLS por trás do postgres_changes
// falha calada. Reassina no auth change pra sobreviver a refresh de token.
export function RotaHojeRealtime() {
  const router = useRouter();

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
        .channel("rota-hoje")
        .on("postgres_changes", { event: "*", schema: "public", table: "servicos" }, () => {
          router.refresh();
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "tecnico_posicao" }, () => {
          router.refresh();
        })
        .subscribe();
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

  return null;
}
