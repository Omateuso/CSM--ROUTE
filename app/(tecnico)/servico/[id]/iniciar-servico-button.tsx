"use client";

import { useActionState } from "react";
import { iniciarServico, type ActionState } from "./actions";
import { FOCUS_RING } from "@/lib/ui/styles";

export function IniciarServicoButton({ servicoId }: { servicoId: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(iniciarServico, {
    error: null,
  });

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="servicoId" value={servicoId} />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={`w-full rounded-[var(--radius-sm)] bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
      >
        {isPending ? "Iniciando..." : "Iniciar atendimento"}
      </button>
    </form>
  );
}
