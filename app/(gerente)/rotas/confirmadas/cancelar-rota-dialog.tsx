"use client";

import { useActionState, useId } from "react";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FIELD_INPUT, FIELD_LABEL, FOCUS_RING } from "@/lib/ui/styles";
import { cancelarRota, type ActionState } from "./actions";

// Cancelar rota confirmada por engano. Deliberadamente com motivo obrigatório e
// confirmação explícita: é uma ação que tira trabalho da tela de um técnico.
export function CancelarRotaDialog({
  open,
  rotaId,
  descricao,
  quantidadeRts,
  onClose,
}: {
  open: boolean;
  rotaId: string | null;
  descricao: string;
  quantidadeRts: number;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(cancelarRota, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, onClose);
  const idMotivo = useId();

  return (
    <Modal open={open} title="Cancelar rota" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="rotaId" value={rotaId ?? ""} />

        <p className="text-sm text-text-secondary">
          A rota de <strong className="text-text-primary">{descricao}</strong> ({quantidadeRts} RT
          {quantidadeRts === 1 ? "" : "s"}) sai da lista do técnico e os chamados voltam a ficar
          disponíveis pra próxima rota. Nada é apagado — a rota fica registrada como cancelada.
        </p>
        <p className="text-sm text-text-secondary">
          Só funciona enquanto nenhum técnico tiver iniciado um atendimento dessa rota.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor={idMotivo} className={FIELD_LABEL}>
            Motivo do cancelamento
          </label>
          <textarea
            id={idMotivo}
            name="motivo"
            required
            rows={3}
            placeholder="Ex.: confirmei com a equipe errada..."
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
            Voltar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={`rounded-[var(--radius-sm)] bg-danger px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-danger-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isPending ? "Cancelando..." : "Cancelar rota"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
