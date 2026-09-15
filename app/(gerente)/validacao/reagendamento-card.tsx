"use client";

import { useState } from "react";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { StatusServicoBadge, type StatusServico } from "@/app/(tecnico)/status-servico-badge";
import { FOCUS_RING } from "@/lib/ui/styles";
import { HistoricoChamado, type HistoricoEvento } from "@/lib/ui/historico-chamado";
import { ReagendarDialog } from "./reagendar-dialog";

export type ServicoTravadoRow = {
  servicoId: string;
  status: "planejado" | "em_execucao" | "em_revisao";
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
