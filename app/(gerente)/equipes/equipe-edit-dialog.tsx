"use client";

import { useActionState, useId } from "react";
import { editarEquipe, type ActionState } from "./actions";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";
import type { EquipeRow, Zona, Responsavel } from "./equipes-manager";

export function EquipeEditDialog({
  open,
  equipe,
  zonas,
  responsaveis,
  onClose,
}: {
  open: boolean;
  equipe: EquipeRow | null;
  zonas: Zona[];
  responsaveis: Responsavel[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(editarEquipe, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, onClose);

  const uid = useId();
  const idNome = `${uid}-nome`;
  const idNumero = `${uid}-numero`;
  const idZona = `${uid}-zona`;
  const idResponsavel = `${uid}-responsavel`;

  if (!equipe) return null;

  return (
    <Modal open={open} title={`Editar ${equipe.nome}`} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={equipe.id} />

        <div className="flex flex-col gap-1">
          <label htmlFor={idNome} className={FIELD_LABEL}>
            Nome
          </label>
          <input
            id={idNome}
            name="nome"
            type="text"
            defaultValue={equipe.nome}
            required
            className={FIELD_INPUT}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idNumero} className={FIELD_LABEL}>
            Número da equipe
          </label>
          <input
            id={idNumero}
            name="numero"
            type="number"
            min={1}
            step={1}
            defaultValue={equipe.numero}
            required
            className={FIELD_INPUT}
          />
          <p className="text-xs text-text-tertiary">
            Aparece no pino do técnico no mapa da Rota do dia. Não pode repetir.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idZona} className={FIELD_LABEL}>
            Zona padrão
          </label>
          <select
            id={idZona}
            name="zonaPadraoId"
            defaultValue={equipe.zonaPadraoId ?? ""}
            className={FIELD_INPUT}
          >
            <option value="">Nenhuma</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idResponsavel} className={FIELD_LABEL}>
            Responsável
          </label>
          <select
            id={idResponsavel}
            name="responsavelId"
            defaultValue={equipe.responsavelId ?? ""}
            className={FIELD_INPUT}
          >
            <option value="">Nenhum</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={equipe.ativo}
            className="h-4 w-4 rounded-sm border-border accent-accent"
          />
          Equipe ativa
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
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
