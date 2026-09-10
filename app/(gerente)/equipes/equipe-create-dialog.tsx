"use client";

import { useActionState, useId } from "react";
import { criarEquipe, type ActionState } from "./actions";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";
import type { Zona, Responsavel } from "./equipes-manager";

export function EquipeCreateDialog({
  open,
  zonas,
  responsaveis,
  numeroSugerido,
  onClose,
}: {
  open: boolean;
  zonas: Zona[];
  responsaveis: Responsavel[];
  /** Próximo número livre — só sugestão; a unicidade é garantida no banco. */
  numeroSugerido: number;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(criarEquipe, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, onClose);

  const uid = useId();
  const idNome = `${uid}-nome`;
  const idNumero = `${uid}-numero`;
  const idZona = `${uid}-zona`;
  const idResponsavel = `${uid}-responsavel`;

  return (
    <Modal open={open} title="Nova equipe" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={idNome} className={FIELD_LABEL}>
            Nome
          </label>
          <input
            id={idNome}
            name="nome"
            type="text"
            placeholder="Equipe 1"
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
            defaultValue={numeroSugerido}
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
          <select id={idZona} name="zonaPadraoId" defaultValue="" className={FIELD_INPUT}>
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
          <select id={idResponsavel} name="responsavelId" defaultValue="" className={FIELD_INPUT}>
            <option value="">Nenhum</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome}
              </option>
            ))}
          </select>
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
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
