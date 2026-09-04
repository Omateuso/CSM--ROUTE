"use client";

import { useActionState, useId, useState } from "react";
import { validarServico, recusarServico, type ActionState } from "./actions";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FIELD_INPUT, FIELD_LABEL, FOCUS_RING } from "@/lib/ui/styles";
import { HistoricoChamado, type HistoricoEvento } from "@/lib/ui/historico-chamado";
import { IntegridadeBadge } from "./integridade-badge";
import { avaliarLocalizacaoConclusao, type EvidenciaComGeo, type OsIntegridadeInfo } from "./integridade";

export type ServicoConcluidoRow = {
  servicoId: string;
  concluidoEm: string | null;
  tecnicoNome: string;
  rtCodigo: string;
  rtNome: string;
  rtEndereco: string;
  rtLatitude: number | null;
  rtLongitude: number | null;
  chamadoAssunto: string;
  chamadoDescricao: string | null;
  prioridade: Prioridade;
  slaPrazo: string | null;
  chamadoStatus: "aberto" | "em_andamento" | "finalizado" | "cancelado";
  tomticketId: string | null;
  observacao: string | null;
  evidencias: EvidenciaComGeo[];
  osIntegridade: OsIntegridadeInfo | null;
  historico: HistoricoEvento[];
};

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const formatoDataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

const LABEL_EVIDENCIA: Record<string, string> = { foto: "Foto", os: "OS", documento: "Documento" };

export function ValidacaoCard({ servico }: { servico: ServicoConcluidoRow }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(validarServico, {
    error: null,
  });
  const [recusarAberto, setRecusarAberto] = useState(false);

  const statusLocalizacao = avaliarLocalizacaoConclusao(servico.evidencias, {
    latitude: servico.rtLatitude,
    longitude: servico.rtLongitude,
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

        {(statusLocalizacao !== "sem_foto" || servico.osIntegridade) && (
          <div className="mt-2 flex flex-wrap gap-3">
            {statusLocalizacao === "confere" && <IntegridadeBadge tone="positivo">✓ Localização confere</IntegridadeBadge>}
            {statusLocalizacao === "sem_localizacao" && <IntegridadeBadge tone="neutro">📍 sem localização</IntegridadeBadge>}
            {statusLocalizacao === "fora_do_limite" && (
              <IntegridadeBadge tone="alerta">⚠️ Localização não confere</IntegridadeBadge>
            )}
            {servico.osIntegridade?.papel === "reaproveitada" && (
              <IntegridadeBadge tone="alerta">
                ⚠️ OS idêntica a outro serviço ({servico.osIntegridade.ref.rtCodigo}
                {servico.osIntegridade.ref.rotaData
                  ? `, ${formatoDataCurta.format(new Date(`${servico.osIntegridade.ref.rotaData}T00:00:00`))}`
                  : ""}
                )
              </IntegridadeBadge>
            )}
            {servico.osIntegridade?.papel === "original" && (
              <IntegridadeBadge tone="neutro">
                ℹ️ OS original — reaproveitada depois em {servico.osIntegridade.ref.rtCodigo}
                {servico.osIntegridade.ref.rotaData
                  ? `, ${formatoDataCurta.format(new Date(`${servico.osIntegridade.ref.rotaData}T00:00:00`))}`
                  : ""}
              </IntegridadeBadge>
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
        <button
          type="button"
          onClick={() => setRecusarAberto(true)}
          className={`rounded-[var(--radius-sm)] border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-danger hover:text-danger ${FOCUS_RING}`}
        >
          Recusar
        </button>
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

      <RecusarDialog
        open={recusarAberto}
        servicoId={servico.servicoId}
        onClose={() => setRecusarAberto(false)}
      />
    </article>
  );
}

// Diferente de "Reagendar" (serviço nunca atendido), "Recusar" é pra quando
// o gerente não confia na evidência de um serviço JÁ concluído — ex.: viu
// um selo de integridade suspeito e, depois de conferir com o técnico por
// fora do sistema, decidiu que precisa voltar. Mesmo efeito de banco do
// reagendamento (cancela, chamado libera pra próxima rota), evento de
// histórico próprio (migration 0025).
function RecusarDialog({
  open,
  servicoId,
  onClose,
}: {
  open: boolean;
  servicoId: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(recusarServico, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, onClose);

  const idMotivo = useId();

  return (
    <Modal open={open} title="Recusar serviço" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="servicoId" value={servicoId} />

        <p className="text-sm text-text-secondary">
          O serviço deixa de contar como concluído e o chamado volta a ficar disponível pra próxima
          rota. Use quando não confiar na evidência anexada — a foto/OS/observação continuam
          registradas na linha do tempo do chamado.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor={idMotivo} className={FIELD_LABEL}>
            Motivo da recusa
          </label>
          <textarea
            id={idMotivo}
            name="motivo"
            required
            rows={3}
            placeholder="Ex.: localização não confere e o técnico não soube explicar..."
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
            className={`rounded-[var(--radius-sm)] bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isPending ? "Recusando..." : "Confirmar recusa"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
