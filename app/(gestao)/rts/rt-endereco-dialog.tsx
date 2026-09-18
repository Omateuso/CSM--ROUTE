"use client";

import { useActionState, useId, useRef } from "react";
import { trocarEnderecoRT, type ActionState } from "./actions";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";

type Regiao = { id: string; nome: string; zonaNome: string };
type RT = {
  id: string;
  codigo: string;
  endereco: string;
  bairro: string;
  latitude: number;
  longitude: number;
  regiao_id: string;
};

export function RtEnderecoDialog({
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
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(trocarEnderecoRT, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, onClose);

  const bairroRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const idRegiao = `${uid}-regiao`;
  const idBairro = `${uid}-bairro`;
  const idEndereco = `${uid}-endereco`;
  const idLatitude = `${uid}-latitude`;
  const idLongitude = `${uid}-longitude`;
  const idMotivo = `${uid}-motivo`;

  if (!rt) return null;

  function handleRegiaoChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const regiao = regioes.find((r) => r.id === event.target.value);
    if (regiao && bairroRef.current && !bairroRef.current.dataset.editadoManualmente) {
      bairroRef.current.value = regiao.nome;
    }
  }

  function handleBairroInput() {
    if (bairroRef.current) bairroRef.current.dataset.editadoManualmente = "true";
  }

  const zonas = [...new Set(regioes.map((r) => r.zonaNome))];

  return (
    <Modal open={open} title={`Trocar endereço — ${rt.codigo}`} onClose={onClose}>
      <p className="mb-4 -mt-2 text-xs leading-relaxed text-text-tertiary">
        Isso fecha o endereço atual no histórico e registra este como o
        novo endereço vigente da RT. O código e o histórico de chamados
        continuam os mesmos.
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={rt.id} />

        <div className="rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-2.5 py-1.5 text-xs text-text-tertiary">
          <span className="font-medium text-text-secondary">Endereço atual: </span>
          {rt.endereco}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idRegiao} className={FIELD_LABEL}>
            Nova região
          </label>
          <select
            id={idRegiao}
            name="regiaoId"
            defaultValue={rt.regiao_id}
            onChange={handleRegiaoChange}
            required
            className={FIELD_INPUT}
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
          <label htmlFor={idBairro} className={FIELD_LABEL}>
            Novo bairro
          </label>
          <input
            ref={bairroRef}
            id={idBairro}
            name="bairro"
            type="text"
            defaultValue={rt.bairro}
            onInput={handleBairroInput}
            required
            className={FIELD_INPUT}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idEndereco} className={FIELD_LABEL}>
            Novo endereço
          </label>
          <input
            id={idEndereco}
            name="endereco"
            type="text"
            placeholder="Rua Exemplo 123 - Casa 01"
            required
            className={FIELD_INPUT}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={idLatitude} className={FIELD_LABEL}>
              Latitude
            </label>
            <input
              id={idLatitude}
              name="latitude"
              type="number"
              step="0.000001"
              placeholder="-22.912345"
              required
              className={`${FIELD_INPUT} font-mono tabular-nums`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idLongitude} className={FIELD_LABEL}>
              Longitude
            </label>
            <input
              id={idLongitude}
              name="longitude"
              type="number"
              step="0.000001"
              placeholder="-43.312345"
              required
              className={`${FIELD_INPUT} font-mono tabular-nums`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idMotivo} className={FIELD_LABEL}>
            Motivo <span className="text-text-tertiary">(opcional)</span>
          </label>
          <input
            id={idMotivo}
            name="motivo"
            type="text"
            placeholder="Ex.: imóvel devolvido ao proprietário"
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
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isPending ? "Salvando..." : "Trocar endereço"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
