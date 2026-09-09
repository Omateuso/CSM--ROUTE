"use client";

import { useActionState, useId } from "react";
import { reagendarServico, type ActionState } from "./actions";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";

// Extraído de reagendamento-card.tsx (09/09/2026) — a mesma caixa de
// "reagendar" agora serve dois lugares: os serviços travados em rota já
// passada e os apontados pelo técnico (Fase 4). `fn_reagendar_servico`
// (0018) já aceita qualquer serviço `planejado`/`em_execucao`, sem checar a
// data da rota — o corte por data é só da tela de "travados".
export function ReagendarDialog({
  open,
  servicoId,
  onClose,
}: {
  open: boolean;
  servicoId: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(reagendarServico, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, onClose);

  const idMotivo = useId();

  return (
    <Modal open={open} title="Reagendar serviço" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="servicoId" value={servicoId} />

        <p className="text-sm text-text-secondary">
          O serviço volta a ficar disponível como candidato pra próxima rota confirmada dessa RT. O
          chamado no TomTicket não é alterado.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor={idMotivo} className={FIELD_LABEL}>
            Motivo do reagendamento
          </label>
          <textarea
            id={idMotivo}
            name="motivo"
            required
            rows={3}
            placeholder="Ex.: técnico não conseguiu chegar na RT nesse dia..."
            className={`${FIELD_INPUT} resize-none`}
          />
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}

        <div className="mt-1 flex items-center justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={`text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING}`}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isPending ? "Reagendando..." : "Confirmar reagendamento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
