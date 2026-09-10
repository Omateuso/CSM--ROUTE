"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ehRespostaAutomaticaIgnorada } from "@/lib/tomticket/mensagens";

type Toast = { id: string; protocolo: string | null; assunto: string };

const DURACAO_MS = 8000;
const MAX_VISIVEIS = 3;

// Aviso flutuante de "mensagem nova de cliente" num chamado (pedido do usuário,
// 10/09/2026). Aparece em qualquer tela do gerente/gestão, além do sino que já
// existe no menu. Ignora as respostas automáticas de prazo (24h/48h) da própria
// CSM — mesma regra da coleta (lib/tomticket/mensagens.ts), aqui como segunda
// camada. Mesmo padrão de Realtime + setAuth do dashboard-realtime.tsx.
export function NovasRespostasToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const vistos = useRef(new Set<string>());

  const remover = useCallback((id: string) => {
    setToasts((atual) => atual.filter((t) => t.id !== id));
  }, []);

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
        .channel("novas-respostas-toast")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chamado_respostas" },
          async (payload) => {
            const nova = payload.new as {
              id: string;
              chamado_id: string;
              tipo: string;
              mensagem: string | null;
              visto_em: string | null;
            };
            if (
              nova.tipo !== "cliente" ||
              nova.visto_em !== null ||
              vistos.current.has(nova.id) ||
              ehRespostaAutomaticaIgnorada(nova.mensagem)
            ) {
              return;
            }
            vistos.current.add(nova.id);

            const { data: chamado } = await supabase
              .from("chamados")
              .select("tomticket_id, assunto")
              .eq("id", nova.chamado_id)
              .maybeSingle();

            const toast: Toast = {
              id: nova.id,
              protocolo: (chamado?.tomticket_id as string | null) ?? null,
              assunto: (chamado?.assunto as string | null) ?? "chamado",
            };
            setToasts((atual) => [...atual, toast].slice(-MAX_VISIVEIS));
            setTimeout(() => remover(nova.id), DURACAO_MS);
          },
        )
        .subscribe();
    }

    assinar();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) supabase.realtime.setAuth(session.access_token);
    });

    return () => {
      cancelado = true;
      subscription.unsubscribe();
      if (canal) supabase.removeChannel(canal);
    };
  }, [remover]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-[100] flex flex-col gap-2"
      role="region"
      aria-label="Avisos de mensagens novas"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="pointer-events-auto w-80 max-w-[calc(100vw-2rem)] rounded-[var(--radius-md)] border border-priority-alta/40 bg-surface p-3 shadow-lg"
        >
          <div className="flex items-start gap-2">
            <span aria-hidden="true">🔔</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary">Nova mensagem de cliente</p>
              <p className="mt-0.5 truncate text-xs text-text-secondary">
                {t.protocolo ? `#${t.protocolo} · ` : ""}
                {t.assunto}
              </p>
              <Link
                href="/chamados"
                onClick={() => remover(t.id)}
                className="mt-1 inline-block text-xs font-medium text-accent hover:text-accent-hover"
              >
                Ver chamado →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => remover(t.id)}
              aria-label="Dispensar aviso"
              className="shrink-0 text-text-tertiary hover:text-text-primary"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
