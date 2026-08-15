"use client";

import { useActionState, useId } from "react";
import { editarRT, type ActionState } from "./actions";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";

export function RtEditDialog({
  open,
  rt,
  onClose,
}: {
  open: boolean;
  rt: { id: string; codigo: string; nome: string; ativo: boolean } | null;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(editarRT, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, onClose);

  const uid = useId();
  const idNome = `${uid}-nome`;

  if (!rt) return null;

  return (
    <Modal open={open} title={`Editar ${rt.codigo}`} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={rt.id} />

        <div className="flex flex-col gap-1">
          <span className={FIELD_LABEL}>Código</span>
          <p className="rounded-[var(--radius-sm)] border border-border bg-surface px-2.5 py-1.5 font-mono text-sm text-text-tertiary">
            {rt.codigo}
          </p>
          <p className="text-xs text-text-tertiary">
            Identidade permanente da RT — não muda depois de criada.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idNome} className={FIELD_LABEL}>
            Nome
          </label>
          <input
            id={idNome}
            name="nome"
            type="text"
            defaultValue={rt.nome}
            required
            className={FIELD_INPUT}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={rt.ativo}
            className="h-4 w-4 rounded-sm border-border accent-accent"
          />
          RT ativa
        </label>

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
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
