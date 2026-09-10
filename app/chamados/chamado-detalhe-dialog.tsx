"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Modal } from "@/lib/ui/modal";
import { FIELD_INPUT, FOCUS_RING } from "@/lib/ui/styles";
import { LightboxImage } from "@/lib/ui/image-lightbox";
import { TOMTICKET_MAX_MENSAGEM } from "@/lib/tomticket/config";
import { PrioridadeBadge } from "./prioridade-badge";
import { SlaBadge } from "./sla-badge";
import { StatusChamadoBadge } from "./status-chamado-badge";
import { HistoricoChamado } from "@/lib/ui/historico-chamado";
import { responderChamado, type RespostaChamadoState } from "./actions";
import type { ChamadoRow } from "./chamados-manager";
import type { DetalheChamado } from "./actions";

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Só leitura, EXCETO a resposta ao cliente (item 8, 10/09/2026): o cliente pode
// responder o chamado no TomTicket e, até aqui, o gerente não tinha como
// responder de volta pelo sistema. O compositor no rodapé da "Conversa do
// chamado" resolve isso. Editar prioridade/status por aqui continua não
// existindo — quem resolve o chamado de verdade é o TomTicket.
export function ChamadoDetalheDialog({
  open,
  chamado,
  detalhe,
  podeResponder,
  onRespondido,
  onClose,
}: {
  open: boolean;
  chamado: ChamadoRow | null;
  /** Mensagem e histórico, buscados quando o modal abre. `null` = carregando. */
  detalhe: DetalheChamado | null;
  /** Só o gerente responde o cliente no TomTicket. */
  podeResponder: boolean;
  /** Chamado após enviar a resposta — pai recarrega a linha do tempo. */
  onRespondido: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title={chamado?.assunto ?? ""} onClose={onClose}>
      {chamado && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <PrioridadeBadge prioridade={chamado.prioridade} />
            <SlaBadge slaPrazo={chamado.slaPrazo} status={chamado.status} />
            <StatusChamadoBadge status={chamado.status} />
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-text-tertiary">RT</dt>
              <dd className="text-text-primary">
                <span className="font-mono text-xs">{chamado.rtCodigo}</span> — {chamado.rtNome}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-tertiary">Protocolo TomTicket</dt>
              <dd className="font-mono text-xs text-text-primary">
                {chamado.tomticketId ?? "— (entrada manual)"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-tertiary">Criado em</dt>
              <dd className="text-text-primary">{formatoData.format(new Date(chamado.criadoEm))}</dd>
            </div>
          </dl>

          <div>
            <p className="mb-1 text-xs text-text-tertiary">Mensagem</p>
            <p className="max-h-64 overflow-y-auto rounded-[var(--radius-sm)] border border-border bg-surface-input p-3 text-sm whitespace-pre-wrap text-text-primary">
              {detalhe === null
                ? "Carregando..."
                : detalhe.descricao || "Sem mensagem registrada."}
            </p>
          </div>

          {detalhe !== null && detalhe.anexosCliente.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-text-tertiary">Evidências do cliente</p>
              <div className="flex flex-wrap gap-3 rounded-[var(--radius-sm)] border border-border p-3">
                {detalhe.anexosCliente.map((a) =>
                  a.url ? (
                    <LightboxImage
                      key={a.id}
                      url={a.url}
                      alt={a.nome}
                      legenda={a.origem === "abertura" ? "Da abertura" : "De uma resposta"}
                    />
                  ) : (
                    <span key={a.id} className="text-xs text-text-tertiary">
                      {a.nome} (indisponível)
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          {detalhe !== null &&
            (detalhe.respostas.length > 0 || (podeResponder && Boolean(chamado.tomticketId))) && (
              <div>
                <p className="mb-1 text-xs text-text-tertiary">Conversa do chamado</p>
                {detalhe.respostas.length > 0 && (
                  <ol className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-[var(--radius-sm)] border border-border p-3">
                    {detalhe.respostas.map((r) => (
                      <li
                        key={r.id}
                        className={`rounded-[var(--radius-sm)] border p-2 text-sm ${
                          r.tipo === "cliente"
                            ? "border-priority-alta/50 bg-priority-alta/5"
                            : "border-border bg-surface-input"
                        }`}
                      >
                        <p className="text-xs text-text-tertiary">
                          <span
                            className={
                              r.tipo === "cliente"
                                ? "font-semibold text-priority-alta"
                                : "font-medium text-text-secondary"
                            }
                          >
                            {r.tipo === "cliente" ? "Cliente" : "Atendente"}
                            {r.remetente ? ` · ${r.remetente}` : ""}
                          </span>
                          {r.respondidoEm ? ` · ${formatoData.format(new Date(r.respondidoEm))}` : ""}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-text-primary">
                          {r.mensagem || "(sem texto)"}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}

                {podeResponder && chamado.tomticketId && (
                  <div className="mt-3">
                    <ResponderChamadoForm chamadoId={chamado.id} onRespondido={onRespondido} />
                  </div>
                )}
              </div>
            )}

          {detalhe !== null && detalhe.historico.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-[var(--radius-sm)] border border-border p-3">
              <HistoricoChamado eventos={detalhe.historico} />
            </div>
          )}

          <div className="flex justify-end border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className={`text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING}`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

const RESPOSTA_INICIAL: RespostaChamadoState = { error: null, aviso: null, ok: false };

// Compositor de resposta ao cliente — vai como mensagem de ATENDENTE no
// TomTicket, com anexos opcionais, sem finalizar o chamado.
function ResponderChamadoForm({
  chamadoId,
  onRespondido,
}: {
  chamadoId: string;
  onRespondido: () => void;
}) {
  const [state, formAction, isPending] = useActionState<RespostaChamadoState, FormData>(
    responderChamado,
    RESPOSTA_INICIAL,
  );
  const [mensagem, setMensagem] = useState("");
  const idMensagem = useId();
  const idArquivos = useId();
  const jaAvisou = useRef(false);

  useEffect(() => {
    if (state.ok && !jaAvisou.current) {
      jaAvisou.current = true;
      onRespondido();
    }
  }, [state.ok, onRespondido]);

  if (state.ok) {
    return (
      <p
        role="status"
        className={`rounded-[var(--radius-sm)] border p-3 text-sm ${
          state.aviso
            ? "border-priority-alta/40 bg-priority-alta/5 text-priority-alta"
            : "border-success/40 bg-success/5 text-success"
        }`}
      >
        {state.aviso ??
          "✓ Resposta enviada ao TomTicket. Ela aparece na conversa acima na próxima sincronização."}
      </p>
    );
  }

  const excedeu = mensagem.length > TOMTICKET_MAX_MENSAGEM;
  const vazia = mensagem.trim() === "";

  return (
    <form action={formAction} className="flex flex-col gap-2 border-t border-border pt-3">
      <input type="hidden" name="chamadoId" value={chamadoId} />
      <label htmlFor={idMensagem} className="text-xs font-medium text-text-secondary">
        Responder o cliente no TomTicket
      </label>
      <textarea
        id={idMensagem}
        name="mensagem"
        required
        rows={4}
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        placeholder="Escreva a resposta que o cliente vai ver no chamado..."
        className={`${FIELD_INPUT} resize-y`}
      />
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={idArquivos} className="text-xs text-text-tertiary">
          Anexos <span className="font-normal">(opcional)</span>
        </label>
        <span className={`text-xs ${excedeu ? "text-danger" : "text-text-tertiary"}`}>
          {mensagem.length}/{TOMTICKET_MAX_MENSAGEM}
        </span>
      </div>
      <input
        id={idArquivos}
        type="file"
        name="arquivos"
        multiple
        className="text-xs text-text-secondary file:mr-3 file:rounded-[var(--radius-sm)] file:border file:border-border file:bg-surface-input file:px-2 file:py-1 file:text-xs file:text-text-primary"
      />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || excedeu || vazia}
          className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {isPending ? "Enviando..." : "Enviar resposta ao TomTicket"}
        </button>
      </div>
    </form>
  );
}
