"use client";

import { useActionState } from "react";
import { iniciarRevisao, type ActionState } from "./actions";
import { FOCUS_RING } from "@/lib/ui/styles";

// Contraparte leve de IniciarServicoForm (migration 0053/0054, 15/09/2026)
// — sem foto, só marca "comecei a revisar" (status `em_revisao`). Amarelo
// (sla-proximo), mesma cor da categoria "revisão técnica" em todo o resto
// do app — verde fica reservado pro atendimento completo (PRIMARY_ACTION_BUTTON).
export function IniciarRevisaoForm({ servicoId }: { servicoId: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(iniciarRevisao, {
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="servicoId" value={servicoId} />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={`w-full rounded-[var(--radius-sm)] bg-sla-proximo px-4 py-3.5 text-base font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
      >
        {isPending ? "Iniciando..." : "Começar a revisar"}
      </button>
    </form>
  );
}
