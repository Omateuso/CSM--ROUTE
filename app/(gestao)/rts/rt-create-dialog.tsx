"use client";

import { useActionState, useId, useRef } from "react";
import { criarRT, type ActionState } from "./actions";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";

type Regiao = { id: string; nome: string; zonaNome: string };
type Caps = { id: string; nome: string };

export function RtCreateDialog({
  open,
  regioes,
  caps,
  onClose,
}: {
  open: boolean;
  regioes: Regiao[];
  caps: Caps[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(criarRT, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, onClose);

  const bairroRef = useRef<HTMLInputElement>(null);
  // Os 3 diálogos da tela ficam sempre montados no DOM (só alternam
  // open/close via showModal/close) — ids fixos colidiriam entre eles.
  const uid = useId();
  const idCodigo = `${uid}-codigo`;
  const idNome = `${uid}-nome`;
  const idRegiao = `${uid}-regiao`;
  const idCaps = `${uid}-caps`;
  const idBairro = `${uid}-bairro`;
  const idEndereco = `${uid}-endereco`;
  const idLatitude = `${uid}-latitude`;
  const idLongitude = `${uid}-longitude`;

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
    <Modal open={open} title="Nova RT" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={idCodigo} className={FIELD_LABEL}>
              Código
            </label>
            <input
              id={idCodigo}
              name="codigo"
              type="text"
              placeholder="SRT 042"
              required
              className={FIELD_INPUT}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idNome} className={FIELD_LABEL}>
              Nome
            </label>
            <input
              id={idNome}
              name="nome"
              type="text"
              placeholder="SRT 042 — Campo Grande"
              required
              className={FIELD_INPUT}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idRegiao} className={FIELD_LABEL}>
            Região
          </label>
          <select
            id={idRegiao}
            name="regiaoId"
            defaultValue=""
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
          <label htmlFor={idCaps} className={FIELD_LABEL}>
            CAPS
          </label>
          <select id={idCaps} name="capsId" defaultValue="" required className={FIELD_INPUT}>
            <option value="" disabled>
              Selecione...
            </option>
            {caps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idBairro} className={FIELD_LABEL}>
            Bairro
          </label>
          <input
            ref={bairroRef}
            id={idBairro}
            name="bairro"
            type="text"
            onInput={handleBairroInput}
            required
            className={FIELD_INPUT}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idEndereco} className={FIELD_LABEL}>
            Endereço
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

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked
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
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
