"use client";

import { useActionState } from "react";
import type { ActionState } from "./actions";
import { FOCUS_RING, TAP_TARGET } from "./styles";

export function DeleteTrigger({
  onClick,
  label = "Excluir",
  ariaLabel,
}: {
  onClick: () => void;
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`text-xs font-medium text-text-tertiary transition-colors hover:text-danger ${FOCUS_RING} ${TAP_TARGET}`}
    >
      {label}
    </button>
  );
}

export function ConfirmDeleteBar({
  action,
  id,
  onCancel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  id: string;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction} className="flex items-center justify-between gap-3">
        <input type="hidden" name="id" value={id} />
        <span className="text-sm text-text-secondary">Confirmar exclusão?</span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className={`text-xs font-medium text-danger transition-colors hover:text-danger-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${TAP_TARGET}`}
          >
            {isPending ? "Excluindo..." : "Sim, excluir"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className={`text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING} ${TAP_TARGET}`}
          >
            Cancelar
          </button>
        </div>
      </form>
      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}
