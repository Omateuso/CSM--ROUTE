"use client";

import { useActionState, useEffect, useId, useRef, type FormEvent } from "react";
import { criarRT, atualizarRT, type ActionState } from "./actions";
import { FOCUS_RING } from "@/lib/ui/styles";

type Regiao = { id: string; nome: string; zonaNome: string };

export type RT = {
  id: string;
  codigo: string;
  nome: string;
  endereco: string;
  bairro: string;
  latitude: number;
  longitude: number;
  ativo: boolean;
  regiao_id: string;
};

const inputClass =
  "w-full rounded-[var(--radius-sm)] border border-border bg-surface-input px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent";
const labelClass = "text-xs font-medium text-text-secondary";

export function RtDialog({
  open,
  rt,
  regioes,
  onClose,
}: {
  open: boolean;
  rt: RT | null;
  regioes: Regiao[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bairroRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const action = rt ? atualizarRT : criarRT;
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(action, {
    error: null,
  });
  const wasPending = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (wasPending.current && !isPending && state.error === null) {
      onClose();
    }
    wasPending.current = isPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, state]);

  function handleRegiaoChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const regiao = regioes.find((r) => r.id === event.target.value);
    if (regiao && bairroRef.current && !bairroRef.current.dataset.editadoManualmente) {
      bairroRef.current.value = regiao.nome;
    }
  }

  function handleBairroInput() {
    if (bairroRef.current) bairroRef.current.dataset.editadoManualmente = "true";
  }

  function handleDialogCancel(event: FormEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  // Clique no backdrop fecha — o alvo do click é o próprio <dialog> só
  // quando cai fora do conteúdo (o <form> cobre toda a área do card).
  function handleBackdropClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onClose();
  }

  const zonas = [...new Set(regioes.map((r) => r.zonaNome))];

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleDialogCancel}
      onClose={onClose}
      onClick={handleBackdropClick}
      aria-labelledby={titleId}
      className="fixed top-1/2 left-1/2 m-0 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-surface p-0 text-text-primary backdrop:bg-text-primary/40"
    >
      <form action={formAction} className="flex flex-col gap-4 p-6">
        {rt && <input type="hidden" name="id" value={rt.id} />}

        <h2 id={titleId} className="text-base font-semibold text-text-primary">
          {rt ? `Editar ${rt.codigo}` : "Nova RT"}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="codigo" className={labelClass}>
              Código
            </label>
            <input
              id="codigo"
              name="codigo"
              type="text"
              placeholder="SRT 042"
              defaultValue={rt?.codigo}
              required
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="nome" className={labelClass}>
              Nome
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              placeholder="SRT 042 — Campo Grande"
              defaultValue={rt?.nome}
              required
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="regiaoId" className={labelClass}>
            Região
          </label>
          <select
            id="regiaoId"
            name="regiaoId"
            defaultValue={rt?.regiao_id ?? ""}
            onChange={handleRegiaoChange}
            required
            className={inputClass}
          >
            <option value="" disabled>
              Selecione...
            </option>
            {zonas.map((zonaNome) => (
              <optgroup key={zonaNome} label={zonaNome}>
                {regioes
                  .filter((r) => r.zonaNome === zonaNome)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="bairro" className={labelClass}>
            Bairro
          </label>
          <input
            ref={bairroRef}
            id="bairro"
            name="bairro"
            type="text"
            defaultValue={rt?.bairro}
            onInput={handleBairroInput}
            required
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="endereco" className={labelClass}>
            Endereço
          </label>
          <input
            id="endereco"
            name="endereco"
            type="text"
            placeholder="Rua Exemplo 123 - Casa 01"
            defaultValue={rt?.endereco}
            required
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="latitude" className={labelClass}>
              Latitude
            </label>
            <input
              id="latitude"
              name="latitude"
              type="number"
              step="0.000001"
              placeholder="-22.912345"
              defaultValue={rt?.latitude}
              required
              className={`${inputClass} font-mono tabular-nums`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="longitude" className={labelClass}>
              Longitude
            </label>
            <input
              id="longitude"
              name="longitude"
              type="number"
              step="0.000001"
              placeholder="-43.312345"
              defaultValue={rt?.longitude}
              required
              className={`${inputClass} font-mono tabular-nums`}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={rt?.ativo ?? true}
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
    </dialog>
  );
}
