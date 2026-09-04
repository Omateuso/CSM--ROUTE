"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { registrarUrgencia, type ActionState } from "./actions";
import { PRIORIDADE_OPTIONS } from "@/app/chamados/prioridade-badge";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";

type Rt = { id: string; codigo: string; endereco: string; zonaNome: string };

// Formulário de "Registrar Urgência" — o gerente leu algo excepcional no
// WhatsApp e precisa capturar isso na hora. Prioridade fica opcional aqui
// de propósito ("solicitada" não é "validada" — a triagem de verdade
// acontece depois, em fn_validar_urgencia).
export function RegistrarUrgenciaDialog({
  open,
  rts,
  onClose,
  onRegistrada,
}: {
  open: boolean;
  rts: Rt[];
  onClose: () => void;
  onRegistrada: (urgenciaId: string) => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(registrarUrgencia, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, () => {
    if (state.urgenciaId) onRegistrada(state.urgenciaId);
    onClose();
  });

  const uid = useId();
  const idRt = `${uid}-rt`;
  const idBusca = `${uid}-busca`;
  const idDescricao = `${uid}-descricao`;
  const idMotivo = `${uid}-motivo`;
  const idSolicitante = `${uid}-solicitante`;
  const idPrioridade = `${uid}-prioridade`;
  const idTomticket = `${uid}-tomticket`;
  const idAnexo = `${uid}-anexo`;

  const [busca, setBusca] = useState("");
  const rtsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return rts;
    return rts.filter((r) => r.codigo.toLowerCase().includes(termo) || r.endereco.toLowerCase().includes(termo));
  }, [rts, busca]);
  const zonas = [...new Set(rtsFiltradas.map((r) => r.zonaNome))];

  return (
    <Modal open={open} title="Registrar urgência" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={idBusca} className={FIELD_LABEL}>
            Buscar RT (código ou endereço)
          </label>
          <input
            id={idBusca}
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex.: SRT 22 ou nome da rua..."
            className={FIELD_INPUT}
          />
        </div>

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
                {rtsFiltradas
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
          <label htmlFor={idDescricao} className={FIELD_LABEL}>
            Descrição
          </label>
          <textarea
            id={idDescricao}
            name="descricao"
            rows={3}
            placeholder="O que foi relatado — o mais literal possível."
            required
            className={`${FIELD_INPUT} resize-none`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={idMotivo} className={FIELD_LABEL}>
            Motivo da urgência
          </label>
          <input
            id={idMotivo}
            name="motivo"
            type="text"
            placeholder="Por que não pode esperar a próxima rota"
            required
            className={FIELD_INPUT}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={idSolicitante} className={FIELD_LABEL}>
              Solicitante
            </label>
            <input
              id={idSolicitante}
              name="solicitante"
              type="text"
              placeholder="Quem relatou no WhatsApp"
              required
              className={FIELD_INPUT}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idTomticket} className={FIELD_LABEL}>
              Protocolo TomTicket
            </label>
            <input
              id={idTomticket}
              name="tomticketId"
              type="text"
              placeholder="Opcional — pode não existir ainda"
              className={`${FIELD_INPUT} font-mono tabular-nums`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={idPrioridade} className={FIELD_LABEL}>
              Prioridade (se já souber)
            </label>
            <select id={idPrioridade} name="prioridade" defaultValue="" className={FIELD_INPUT}>
              <option value="">Decidir na análise</option>
              {PRIORIDADE_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idAnexo} className={FIELD_LABEL}>
              Anexo (opcional)
            </label>
            <input id={idAnexo} name="anexo" type="file" accept="image/*,application/pdf" className={FIELD_INPUT} />
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
            {isPending ? "Registrando..." : "Registrar urgência"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
