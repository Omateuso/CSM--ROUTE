"use client";

import { useActionState, useId, useState } from "react";
import { validarServico, solicitarCorrecao, type ActionState } from "./actions";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FIELD_INPUT, FIELD_LABEL, FOCUS_RING } from "@/lib/ui/styles";
import { HistoricoChamado, type HistoricoEvento } from "@/lib/ui/historico-chamado";
import { EvidenciaThumbs, rotuloEvidencia } from "@/lib/ui/evidencia-thumbs";
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

export function ValidacaoCard({ servico }: { servico: ServicoConcluidoRow }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(validarServico, {
    error: null,
  });
  const [correcaoAberto, setCorrecaoAberto] = useState(false);

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
          <div className="mt-2">
            <EvidenciaThumbs
              itens={servico.evidencias
                .filter((e) => e.url)
                .map((e) => ({ url: e.url, label: rotuloEvidencia(e) }))}
            />
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
          onClick={() => setCorrecaoAberto(true)}
          className={`rounded-[var(--radius-sm)] border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent ${FOCUS_RING}`}
        >
          Solicitar correção
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

      <CorrecaoDialog
        open={correcaoAberto}
        servicoId={servico.servicoId}
        onClose={() => setCorrecaoAberto(false)}
      />
    </article>
  );
}

// "Solicitar correção" (antes "Recusar", 0025/0039) — o gerente vê um
// problema na evidência de um serviço JÁ concluído e precisa que volte.
// Mesmo efeito de banco do reagendamento (cancela, chamado libera pra
// próxima rota e reentra como "↩ Retorno" na Fase 1), evento de histórico
// próprio (`servico_correcao_solicitada`). É reframe, não punição — daí a
// linguagem e o botão neutro (accent), não vermelho.
function CorrecaoDialog({
  open,
  servicoId,
  onClose,
}: {
  open: boolean;
  servicoId: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(solicitarCorrecao, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, onClose);

  const idMotivo = useId();

  return (
    <Modal open={open} title="Solicitar correção" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="servicoId" value={servicoId} />

        <p className="text-sm text-text-secondary">
          O serviço volta pra fila e o chamado entra de novo numa próxima rota, aparecendo pro técnico
          como retorno — com o que já foi feito registrado na linha do tempo. Diga o que precisa ser
          ajustado.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor={idMotivo} className={FIELD_LABEL}>
            O que precisa ser corrigido?
          </label>
          <textarea
            id={idMotivo}
            name="motivo"
            required
            rows={3}
            placeholder="Ex.: a foto de depois não mostra o serviço concluído; refazer com foto do ponto reparado."
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
            {isPending ? "Enviando..." : "Enviar solicitação"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
