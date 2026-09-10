import { createClient } from "@/lib/supabase/client";
import type { AdaptadorRealtime, Assinatura, OpcoesAssinatura } from "./tipos";

// Adaptador do Realtime do Supabase — o transporte em uso hoje.
//
// Guarda o achado que custou caro em 19/08/2026 (Fase 4/Parte B): o client
// do `@supabase/ssr` NÃO garante que o token da sessão esteja no socket no
// momento em que o canal assina. Sem `setAuth` antes do `.subscribe()`, a
// assinatura chega a SUBSCRIBED e a checagem de RLS por trás do
// postgres_changes falha CALADA — nenhum evento chega, nenhum erro aparece.
// O `onAuthStateChange` reforça isso pra sobreviver a um refresh de token
// numa sessão longa de painel aberto.
//
// Esse detalhe estava copiado em 3 telas. Agora vive aqui.
export const adaptadorSupabase: AdaptadorRealtime = {
  nome: "supabase",

  assinar({ canal, alvos, aoMudar, aoConectar }: OpcoesAssinatura): Assinatura {
    const supabase = createClient();
    let inscricao: ReturnType<typeof supabase.channel> | null = null;
    let cancelado = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) await supabase.realtime.setAuth(session.access_token);
      if (cancelado) return;

      let construtor = supabase.channel(canal);
      for (const alvo of alvos) {
        construtor = construtor.on(
          "postgres_changes",
          { event: alvo.evento ?? "*", schema: "public", table: alvo.tabela },
          () => aoMudar(),
        );
      }
      inscricao = construtor.subscribe((status) => aoConectar?.(status === "SUBSCRIBED"));
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (session) supabase.realtime.setAuth(session.access_token);
    });

    return {
      encerrar() {
        cancelado = true;
        subscription.unsubscribe();
        if (inscricao) supabase.removeChannel(inscricao);
      },
    };
  },
};
