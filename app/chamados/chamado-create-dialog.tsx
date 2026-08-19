"use client";

import { useActionState, useId } from "react";
import { criarChamado, type ActionState } from "./actions";
import { PRIORIDADE_OPTIONS } from "./prioridade-badge";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";

type Rt = { id: string; codigo: string; endereco: string; zonaNome: string };

export function ChamadoCreateDialog({
  open,
  rts,
  onClose,
}: {
  open: boolean;
  rts: Rt[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(criarChamado, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, onClose);

  const uid = useId();
  const idRt = `${uid}-rt`;
  const idAssunto = `${uid}-assunto`;
  const idDescricao = `${uid}-descricao`;
  const idPrioridade = `${uid}-prioridade`;
  const idTomticket = `${uid}-tomticket`;

  const zonas = [...new Set(rts.map((r) => r.zonaNome))];

  return (
    <Modal open={open} title="Novo chamado" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={idRt} className={FIELD_LABEL}>
            RT
          </label>
          <select id={idRt} name="rtId" defaultValue="" required className={FIELD_INPUT}>
            <option value="" disabled>
              Selecione...
            </option>
            {zonas.map((zonaNome) => (
              <optgroup key={zonaNome} label={zonaNome}>
                {rts
                  .filter((r) => r.zonaNome === zonaNome)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.codigo} — {r.endereco}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idAssunto} className={FIELD_LABEL}>
            Assunto
          </label>
          <input
            id={idAssunto}
            name="assunto"
            type="text"
            placeholder="Vazamento no banheiro"
            required
            className={FIELD_INPUT}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idDescricao} className={FIELD_LABEL}>
            Descrição
          </label>
          <textarea
            id={idDescricao}
            name="descricao"
            rows={3}
            placeholder="Detalhes do chamado (opcional)"
            className={`${FIELD_INPUT} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={idPrioridade} className={FIELD_LABEL}>
              Prioridade
            </label>
            <select
              id={idPrioridade}
              name="prioridade"
              defaultValue="normal"
              required
              className={FIELD_INPUT}
            >
              {PRIORIDADE_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idTomticket} className={FIELD_LABEL}>
              Protocolo TomTicket
            </label>
            <input
              id={idTomticket}
              name="tomticketId"
              type="text"
              placeholder="Opcional"
              className={`${FIELD_INPUT} font-mono tabular-nums`}
            />
          </div>
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
