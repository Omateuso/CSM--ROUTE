"use client";

import { useActionState, useId, useState } from "react";
import { analisarUrgencia, validarUrgencia, invalidarUrgencia, cancelarUrgencia, type ActionState } from "../actions";
import { PRIORIDADE_OPTIONS } from "@/app/chamados/prioridade-badge";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";
import type { Prioridade } from "@/app/chamados/prioridade-badge";

const ESTADO_INICIAL: ActionState = { error: null };

// Ações de triagem (seções 5/7/8/18 do prompt): analisar, validar
// (classifica a urgência — nunca a prioridade do TomTicket, que fica
// intocada), marcar como não validada, ou cancelar. Uma só por vez —
// o status da urgência já garante quais fazem sentido em cada momento.
export function UrgenciaAcoes({
  urgenciaId,
  status,
  prioridadeSugerida,
}: {
  urgenciaId: string;
  status: "solicitada" | "em_analise" | "nao_validada" | "cancelada";
  prioridadeSugerida: Prioridade;
}) {
  const [modal, setModal] = useState<"validar" | "invalidar" | "cancelar" | null>(null);
  const [analisarState, analisarAction, analisarPending] = useActionState<ActionState, FormData>(
    analisarUrgencia,
    ESTADO_INICIAL,
  );

  if (status === "nao_validada" || status === "cancelada") return null;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] bg-surface shadow-lift p-4">
      <p className="text-sm font-semibold text-text-primary">Triagem</p>

      {status === "solicitada" && (
        <form action={analisarAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="urgenciaId" value={urgenciaId} />
          <button
            type="submit"
            disabled={analisarPending}
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {analisarPending ? "Iniciando..." : "Iniciar análise"}
          </button>
          <button
            type="button"
            onClick={() => setModal("cancelar")}
            className={`text-sm font-medium text-text-tertiary transition-colors hover:text-danger ${FOCUS_RING}`}
          >
            Cancelar registro
          </button>
          {analisarState.error && <p className="w-full text-sm text-danger">{analisarState.error}</p>}
        </form>
      )}

      {status === "em_analise" && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setModal("validar")}
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover ${FOCUS_RING}`}
          >
            Validar urgência
          </button>
          <button
            type="button"
            onClick={() => setModal("invalidar")}
            className={`text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING}`}
          >
            Marcar como não validada
          </button>
          <button
            type="button"
            onClick={() => setModal("cancelar")}
            className={`text-sm font-medium text-text-tertiary transition-colors hover:text-danger ${FOCUS_RING}`}
          >
            Cancelar registro
          </button>
        </div>
      )}

      {modal === "validar" && (
        <MotivoModal
          titulo="Validar urgência"
          urgenciaId={urgenciaId}
          action={validarUrgencia}
          onClose={() => setModal(null)}
          botao="Validar"
          campo={{ nome: "prioridade", label: "Classificação da urgência", tipo: "prioridade", padrao: prioridadeSugerida }}
          explicacao="Não confunda com a prioridade do TomTicket (mostrada acima, e nunca alterada por aqui) — isto é só a classificação operacional desta urgência, pra ordenar a fila de despacho."
        />
      )}
      {modal === "invalidar" && (
        <MotivoModal
          titulo="Marcar como não validada"
          urgenciaId={urgenciaId}
          action={invalidarUrgencia}
          onClose={() => setModal(null)}
          botao="Confirmar"
          campo={{ nome: "motivo", label: "Motivo", tipo: "texto" }}
        />
      )}
      {modal === "cancelar" && (
        <MotivoModal
          titulo="Cancelar urgência"
          urgenciaId={urgenciaId}
          action={cancelarUrgencia}
          onClose={() => setModal(null)}
          botao="Cancelar urgência"
          campo={{ nome: "motivo", label: "Motivo do cancelamento", tipo: "texto" }}
        />
      )}
    </div>
  );
}

type Campo =
  | { nome: string; label: string; tipo: "texto" }
  | { nome: string; label: string; tipo: "prioridade"; padrao: Prioridade };

function MotivoModal({
  titulo,
  urgenciaId,
  action,
  onClose,
  botao,
  campo,
  explicacao,
}: {
  titulo: string;
  urgenciaId: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  onClose: () => void;
  botao: string;
  campo: Campo;
  explicacao?: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(action, ESTADO_INICIAL);
  useCloseOnSuccess(isPending, state.error, onClose);
  const idCampo = useId();

  return (
    <Modal open title={titulo} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="urgenciaId" value={urgenciaId} />

        {explicacao && <p className="text-xs text-text-tertiary">{explicacao}</p>}

        <div className="flex flex-col gap-1">
          <label htmlFor={idCampo} className={FIELD_LABEL}>
            {campo.label}
          </label>
          {campo.tipo === "prioridade" ? (
            <select id={idCampo} name={campo.nome} defaultValue={campo.padrao} required className={FIELD_INPUT}>
              {PRIORIDADE_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          ) : (
            <textarea id={idCampo} name={campo.nome} rows={3} required className={`${FIELD_INPUT} resize-none`} />
          )}
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
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isPending ? "Enviando..." : botao}
          </button>
        </div>
      </form>
    </Modal>
  );
}
