"use client";

import { useActionState } from "react";
import { validarServico, type ActionState } from "./actions";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { FOCUS_RING } from "@/lib/ui/styles";
import { HistoricoChamado, type HistoricoEvento } from "@/lib/ui/historico-chamado";

export type ServicoConcluidoRow = {
  servicoId: string;
  concluidoEm: string | null;
  tecnicoNome: string;
  rtCodigo: string;
  rtNome: string;
  rtEndereco: string;
  chamadoAssunto: string;
  chamadoDescricao: string | null;
  prioridade: Prioridade;
  slaPrazo: string | null;
  chamadoStatus: "aberto" | "em_andamento" | "finalizado" | "cancelado";
  tomticketId: string | null;
  observacao: string | null;
  evidencias: { tipo: "foto" | "os" | "documento"; url: string | null }[];
  historico: HistoricoEvento[];
};

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const LABEL_EVIDENCIA: Record<string, string> = { foto: "Foto", os: "OS", documento: "Documento" };

export function ValidacaoCard({ servico }: { servico: ServicoConcluidoRow }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(validarServico, {
    error: null,
  });

  return (
    <article className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-secondary">{servico.rtCodigo}</span>
            {servico.tomticketId && (
              <span className="font-mono text-xs text-text-tertiary">#{servico.tomticketId}</span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-semibold text-text-primary">{servico.rtNome}</p>
          <p className="text-xs text-text-tertiary">{servico.rtEndereco}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PrioridadeBadge prioridade={servico.prioridade} />
          <SlaBadge slaPrazo={servico.slaPrazo} status={servico.chamadoStatus} />
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <p className="text-sm font-medium text-text-primary">{servico.chamadoAssunto}</p>
        {servico.chamadoDescricao && (
          <p className="mt-1 text-sm whitespace-pre-wrap text-text-secondary">{servico.chamadoDescricao}</p>
        )}
      </div>

      <div className="mt-3 rounded-[var(--radius-sm)] bg-surface-input p-3">
        <p className="text-xs text-text-tertiary">
          Concluído por <strong className="text-text-secondary">{servico.tecnicoNome}</strong>
          {servico.concluidoEm ? ` em ${formatoDataHora.format(new Date(servico.concluidoEm))}` : ""}
        </p>
        <p className="mt-1.5 text-sm whitespace-pre-wrap text-text-primary">
          {servico.observacao || "Sem observação registrada."}
        </p>

        {servico.evidencias.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-3">
            {servico.evidencias.map((e, i) =>
              e.url ? (
                <a
                  key={i}
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
                >
                  {LABEL_EVIDENCIA[e.tipo] ?? e.tipo} →
                </a>
              ) : null,
            )}
          </div>
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

      {state.error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="mt-4 flex items-center justify-end gap-3">
        <form action={formAction}>
          <input type="hidden" name="servicoId" value={servico.servicoId} />
          <button
            type="submit"
            disabled={isPending}
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isPending ? "Validando..." : "Validar"}
          </button>
        </form>
      </div>
    </article>
  );
}
