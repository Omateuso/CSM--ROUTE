"use client";

import { useActionState, useId, useState } from "react";
import { reagendarServico, type ActionState } from "./actions";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { StatusServicoBadge, type StatusServico } from "@/app/(tecnico)/status-servico-badge";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";
import { HistoricoChamado, type HistoricoEvento } from "@/lib/ui/historico-chamado";

export type ServicoTravadoRow = {
  servicoId: string;
  status: "planejado" | "em_execucao";
  rotaData: string;
  tecnicoNome: string;
  rtCodigo: string;
  rtNome: string;
  chamadoAssunto: string;
  prioridade: Prioridade;
  slaPrazo: string | null;
  chamadoStatus: "aberto" | "em_andamento" | "finalizado" | "cancelado";
  tomticketId: string | null;
  historico: HistoricoEvento[];
};

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function ReagendamentoCard({ servico }: { servico: ServicoTravadoRow }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-text-secondary">{servico.rtCodigo}</span>
          {servico.tomticketId && (
            <span className="font-mono text-xs text-text-tertiary">#{servico.tomticketId}</span>
          )}
          <StatusServicoBadge status={servico.status as StatusServico} />
        </div>
        <p className="mt-0.5 truncate text-sm font-medium text-text-primary">{servico.chamadoAssunto}</p>
        <p className="mt-0.5 text-xs text-text-tertiary">
          {servico.rtNome} · técnico <strong className="text-text-secondary">{servico.tecnicoNome}</strong> ·
          rota de {formatoData.format(new Date(`${servico.rotaData}T00:00:00`))}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <PrioridadeBadge prioridade={servico.prioridade} />
        <SlaBadge slaPrazo={servico.slaPrazo} status={servico.chamadoStatus} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`rounded-[var(--radius-sm)] border border-border px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent ${FOCUS_RING}`}
        >
          Reagendar
        </button>
      </div>

      {servico.historico.length > 0 && (
        <details className="w-full rounded-[var(--radius-sm)] border border-border p-3">
          <summary className="cursor-pointer text-xs font-medium text-text-secondary">
            Ver linha do tempo ({servico.historico.length})
          </summary>
          <div className="mt-2">
            <HistoricoChamado eventos={servico.historico} />
          </div>
        </details>
      )}

      <ReagendarDialog open={open} servicoId={servico.servicoId} onClose={() => setOpen(false)} />
    </article>
  );
}

function ReagendarDialog({
  open,
  servicoId,
  onClose,
}: {
  open: boolean;
  servicoId: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(reagendarServico, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, onClose);

  const idMotivo = useId();

  return (
    <Modal open={open} title="Reagendar serviço" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="servicoId" value={servicoId} />

        <p className="text-sm text-text-secondary">
          O serviço volta a ficar disponível como candidato pra próxima rota confirmada dessa RT.
          O chamado no TomTicket não é alterado.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor={idMotivo} className={FIELD_LABEL}>
            Motivo do reagendamento
          </label>
          <textarea
            id={idMotivo}
            name="motivo"
            required
            rows={3}
            placeholder="Ex.: técnico não conseguiu chegar na RT nesse dia..."
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
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isPending ? "Reagendando..." : "Confirmar reagendamento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
