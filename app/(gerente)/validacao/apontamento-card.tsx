"use client";

import { useState } from "react";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { FOCUS_RING } from "@/lib/ui/styles";
import { HistoricoChamado, type HistoricoEvento } from "@/lib/ui/historico-chamado";
import { ReagendarDialog } from "./reagendar-dialog";

// Fase 4 (seção 7, migration 0037) — serviço `planejado` em que o técnico
// apontou um problema antes de iniciar. O serviço NÃO muda de status por
// isso; o gerente lê o apontamento e decide. A ação oferecida aqui é
// "Reagendar" (cancela o serviço, libera o chamado pra próxima rota) — se
// preferir manter, é só ignorar o card, que some sozinho quando o técnico
// iniciar o atendimento.
export type ApontamentoRow = {
  servicoId: string;
  apontadoEm: string;
  descricao: string;
  fotoUrl: string | null;
  tecnicoNome: string;
  rtCodigo: string;
  rtNome: string;
  chamadoAssunto: string;
  prioridade: Prioridade;
  slaPrazo: string | null;
  chamadoStatus: "aberto" | "em_andamento" | "finalizado" | "cancelado";
  tomticketId: string | null;
  rotaData: string | null;
  historico: HistoricoEvento[];
};

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function ApontamentoCard({ servico }: { servico: ApontamentoRow }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-text-secondary">{servico.rtCodigo}</span>
            {servico.tomticketId && (
              <span className="font-mono text-xs text-text-tertiary">#{servico.tomticketId}</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-text-primary">{servico.chamadoAssunto}</p>
          <p className="mt-0.5 text-xs text-text-tertiary">
            {servico.rtNome} · técnico <strong className="text-text-secondary">{servico.tecnicoNome}</strong>
            {servico.rotaData && (
              <> · rota de {formatoData.format(new Date(`${servico.rotaData}T00:00:00`))}</>
            )}{" "}
            · apontado em {formatoData.format(new Date(servico.apontadoEm))}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
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
      </div>

      <div className="mt-3 rounded-[var(--radius-sm)] border border-border bg-surface-input p-3">
        <p className="text-xs font-semibold tracking-wide text-text-tertiary uppercase">
          Problema apontado pelo técnico
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap text-text-primary">{servico.descricao}</p>
        {servico.fotoUrl && (
          <a
            href={servico.fotoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-3 inline-block ${FOCUS_RING}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do bucket privado */}
            <img
              src={servico.fotoUrl}
              alt="Foto do apontamento"
              className="h-28 w-28 rounded-[var(--radius-sm)] border border-border object-cover transition-opacity hover:opacity-80"
            />
          </a>
        )}
      </div>

      {servico.historico.length > 0 && (
        <details className="mt-3 rounded-[var(--radius-sm)] border border-border p-3">
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
