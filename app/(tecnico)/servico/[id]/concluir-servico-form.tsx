"use client";

import { useActionState, useId } from "react";
import { concluirServico, type ActionState } from "./actions";
import { FIELD_INPUT, FIELD_LABEL, FOCUS_RING } from "@/lib/ui/styles";

export function ConcluirServicoForm({ servicoId }: { servicoId: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(concluirServico, {
    error: null,
  });

  const uid = useId();
  const idObservacao = `${uid}-observacao`;
  const idFotos = `${uid}-fotos`;
  const idOs = `${uid}-os`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="servicoId" value={servicoId} />

      <div className="flex flex-col gap-1">
        <label htmlFor={idObservacao} className={FIELD_LABEL}>
          O que foi feito
        </label>
        <textarea
          id={idObservacao}
          name="observacao"
          required
          rows={4}
          placeholder="Descreva o serviço realizado..."
          className={`${FIELD_INPUT} resize-none`}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idFotos} className={FIELD_LABEL}>
          Foto do serviço <span className="text-text-tertiary">(opcional)</span>
        </label>
        <input
          id={idFotos}
          name="fotos"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="text-sm text-text-secondary file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idOs} className={FIELD_LABEL}>
          OS (foto ou PDF)
        </label>
        <input
          id={idOs}
          name="os"
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          required
          className="text-sm text-text-secondary file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={`mt-1 w-full rounded-[var(--radius-sm)] bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
      >
        {isPending ? "Enviando..." : "Concluir serviço"}
      </button>
    </form>
  );
}
