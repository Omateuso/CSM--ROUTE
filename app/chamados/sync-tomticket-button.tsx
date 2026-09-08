"use client";

import { useActionState } from "react";
import { FOCUS_RING } from "@/lib/ui/styles";
import { sincronizarComTomticket, type SyncState } from "./sync-actions";

const SYNC_INICIAL: SyncState = { error: null, resumo: null };

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export type SyncInfo = {
  ultimaLeitura: string | null;
  ultimaExecucao: string | null;
  ultimoErro: string | null;
  naoImportados: number;
};

// Sem isto, a coleta pode morrer e a tela segue mostrando a última foto sem
// ninguém perceber — o `exemplo_web.py` da base-automatizacao resolve o mesmo
// problema com um endpoint `/chamados/estado`. Aqui a informação fica do lado
// do botão: quando foi a última leitura e se a última tentativa falhou.
export function SyncTomticketButton({ info, ativo }: { info: SyncInfo; ativo: boolean }) {
  const [state, formAction, isPending] = useActionState<SyncState, FormData>(
    () => sincronizarComTomticket(),
    SYNC_INICIAL,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending || !ativo}
          title={ativo ? undefined : "Falta configurar o token da API do TomTicket (TOMTICKET_TOKEN)."}
          className={`rounded-[var(--radius-sm)] border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {isPending ? "Sincronizando..." : "Sincronizar com o TomTicket"}
        </button>
      </form>

      {state.error ? (
        <p role="alert" className="max-w-xs text-right text-xs text-danger">
          {state.error}
        </p>
      ) : state.resumo ? (
        <p className="max-w-xs text-right text-xs text-success">{state.resumo}</p>
      ) : info.ultimoErro ? (
        <p className="max-w-xs text-right text-xs text-danger">
          Última tentativa falhou: {info.ultimoErro}
        </p>
      ) : !ativo ? (
        <p className="max-w-xs text-right text-xs text-priority-alta">
          Falta o token da API do TomTicket (TOMTICKET_TOKEN no .env.local) — sem ele não dá pra
          sincronizar.
        </p>
      ) : (
        <p className="text-xs text-text-tertiary">
          {info.ultimaLeitura
            ? `Última sincronização: ${formatoDataHora.format(new Date(info.ultimaLeitura))}`
            : "Nunca sincronizado."}
        </p>
      )}

      {info.naoImportados > 0 && (
        <p className="text-xs text-priority-alta">
          {info.naoImportados} chamado(s) não importado(s) — RT não encontrada.
        </p>
      )}
    </div>
  );
}
