"use client";

import { useMemo, useState } from "react";
import { FOCUS_RING } from "@/lib/ui/styles";
import { tomticketSearchUrl } from "@/lib/tomticket/busca";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { HistoricoChamado, type HistoricoEvento } from "@/lib/ui/historico-chamado";
import { IntegridadeBadge } from "./integridade-badge";
import { ResponderTomticket } from "../responder-tomticket";
import { avaliarLocalizacaoConclusao, type EvidenciaComGeo, type OsIntegridadeInfo } from "./integridade";

export type ValidadoRow = {
  validacaoId: string;
  servicoId: string;
  /** Recibo do envio ao TomTicket (migration 0028). Preenchido = já respondido. */
  tomticketRespostaId: string | null;
  respondidoEm: string | null;
  validadoEm: string;
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

// Mesmo layout de card do ValidacaoCard (Aguardando validação) — depois de
// validado, o texto do técnico e os anexos (OS/foto) somem de qualquer
// outra tela; o gerente precisa deles aqui pra copiar o texto e anexar a
// OS de volta no TomTicket (pedido do usuário, 19/08/2026).
function ValidadoCard({
  servico,
  mensagemPadrao,
  integracaoAtiva,
}: {
  servico: ValidadoRow;
  mensagemPadrao: string;
  integracaoAtiva: boolean;
}) {
  const statusLocalizacao = avaliarLocalizacaoConclusao(servico.evidencias, {
    latitude: servico.rtLatitude,
    longitude: servico.rtLongitude,
  });

  // Os mesmos arquivos que o server action vai anexar (conclusão = antes,
  // depois e OS) — listados no diálogo pra o gerente ver o que vai junto.
  const anexos = servico.evidencias
    .filter((e) => e.tipo === "os" || e.momento === "antes" || e.momento === "depois")
    .map((e) => (e.tipo === "os" ? "OS" : e.momento === "antes" ? "Foto antes" : "Foto depois"));

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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-xs text-text-tertiary">
          Validado em {formatoDataHora.format(new Date(servico.validadoEm))}
        </p>
        {servico.tomticketId ? (
          <div className="flex flex-wrap items-center gap-3">
            {/* O link continua: é por onde o gerente confere no TomTicket o
                que foi enviado. */}
            <a
              href={tomticketSearchUrl(servico.tomticketId)}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-xs font-medium text-text-tertiary transition-colors hover:text-accent ${FOCUS_RING}`}
            >
              Ir para o TomTicket →
            </a>
            <ResponderTomticket
              servicoId={servico.servicoId}
              tipo="conclusao"
              mensagemPadrao={mensagemPadrao}
              anexos={anexos}
              rotuloBotao="Confirmar conclusão do chamado"
              tituloModal="Responder o chamado no TomTicket"
              respondido={servico.tomticketRespostaId !== null}
              respondidoEm={servico.respondidoEm}
              localizacaoDivergente={statusLocalizacao === "fora_do_limite"}
              integracaoAtiva={integracaoAtiva}
            />
          </div>
        ) : (
          <span className="text-xs text-text-tertiary">Sem protocolo do TomTicket</span>
        )}
      </div>
    </article>
  );
}

export function ValidadosRecentes({
  validados,
  id,
  mensagemPadrao,
  integracaoAtiva,
}: {
  validados: ValidadoRow[];
  id?: string;
  mensagemPadrao: string;
  integracaoAtiva: boolean;
}) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return validados;
    return validados.filter(
      (v) =>
        v.chamadoAssunto.toLowerCase().includes(termo) ||
        v.rtCodigo.toLowerCase().includes(termo) ||
        v.rtNome.toLowerCase().includes(termo) ||
        (v.tomticketId ?? "").toLowerCase().includes(termo),
    );
  }, [validados, busca]);

  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="text-sm font-semibold text-text-primary">
        Validados recentemente <span className="font-normal text-text-tertiary">({validados.length})</span>
      </h2>
      <p className="mt-1 text-xs text-text-tertiary">
        Os últimos serviços fechados por você — confira a evidência e responda o chamado no TomTicket,
        com os anexos, sem sair daqui.
      </p>

      {validados.length > 0 && (
        <div className="mt-3">
          <label className="sr-only" htmlFor="busca-validados">
            Buscar validados
          </label>
          <input
            id="busca-validados"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por assunto, RT ou protocolo..."
            className="w-full rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      {validados.length === 0 ? (
        <p className="mt-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-8 text-center text-sm text-text-tertiary">
          Nenhum serviço validado ainda.
        </p>
      ) : filtrados.length === 0 ? (
        <p className="mt-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-8 text-center text-sm text-text-tertiary">
          Nenhum validado encontrado com essa busca.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {filtrados.map((v) => (
            <ValidadoCard
              key={v.validacaoId}
              servico={v}
              mensagemPadrao={mensagemPadrao}
              integracaoAtiva={integracaoAtiva}
            />
          ))}
        </div>
      )}
    </section>
  );
}
