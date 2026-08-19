"use client";

import { useActionState, useId } from "react";
import { corrigirDataRota, type ActionState } from "./actions";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";

export function CorrigirDataDialog({
  open,
  rotaId,
  dataAtual,
  onClose,
  onCorrigido,
}: {
  open: boolean;
  rotaId: string | null;
  dataAtual: string | null;
  onClose: () => void;
  onCorrigido: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(corrigirDataRota, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, () => {
    onCorrigido();
    onClose();
  });

  const idData = useId();

  return (
    <Modal open={open} title="Corrigir data da rota" onClose={onClose}>
      {rotaId && (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="rotaId" value={rotaId} />

          <p className="text-sm text-text-secondary">
            Só a data pode ser corrigida, e só enquanto nenhum técnico começou a atender
            nenhum serviço dessa rota — RTs, técnicos e ordem continuam fixos.
          </p>

          <div className="flex flex-col gap-1">
            <label htmlFor={idData} className={FIELD_LABEL}>
              Nova data
            </label>
            <input
              id={idData}
              name="novaData"
              type="date"
              defaultValue={dataAtual ?? undefined}
              required
              className={FIELD_INPUT}
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
              {isPending ? "Salvando..." : "Salvar data"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
