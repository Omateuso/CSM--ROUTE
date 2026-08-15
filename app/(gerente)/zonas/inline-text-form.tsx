"use client";

import { useActionState, useEffect, useId, useRef, type KeyboardEvent } from "react";
import type { ActionState } from "./actions";
import { FOCUS_RING, TAP_TARGET } from "./styles";

export function InlineTextForm({
  action,
  hiddenFields,
  defaultValue = "",
  label,
  placeholder,
  submitLabel,
  onCancel,
  onSuccess,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  hiddenFields?: Record<string, string>;
  defaultValue?: string;
  label: string;
  placeholder: string;
  submitLabel: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });
  const wasPending = useRef(false);
  const inputId = useId();

  useEffect(() => {
    if (wasPending.current && !isPending && state.error === null) {
      onSuccess();
    }
    wasPending.current = isPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, state]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <input
          id={inputId}
          type="text"
          name="nome"
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoFocus
          required
          disabled={isPending}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-[var(--radius-sm)] border border-border bg-surface-input px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent ${FOCUS_RING}`}
        />
        <button
          type="submit"
          disabled={isPending}
          className={`shrink-0 rounded-[var(--radius-sm)] bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {isPending ? "Salvando..." : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className={`shrink-0 rounded-[var(--radius-sm)] text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING} ${TAP_TARGET}`}
        >
          Cancelar
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
