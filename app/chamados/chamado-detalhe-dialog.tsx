"use client";

import { Modal } from "@/lib/ui/modal";
import { FOCUS_RING } from "@/lib/ui/styles";
import { PrioridadeBadge } from "./prioridade-badge";
import { SlaBadge } from "./sla-badge";
import { StatusChamadoBadge } from "./status-chamado-badge";
import { HistoricoChamado } from "@/lib/ui/historico-chamado";
import type { ChamadoRow } from "./chamados-manager";
import type { DetalheChamado } from "./actions";

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Só leitura de propósito — editar prioridade/status por aqui deixava de
// fazer sentido depois que ficou claro que quem resolve o chamado de
// verdade é o TomTicket, não este sistema (ver docs/atualizacoes-futuras.md,
// item do botão "Abrir no TomTicket"). Essa tela é um espelho, não um
// editor.
export function ChamadoDetalheDialog({
  open,
  chamado,
  detalhe,
  onClose,
}: {
  open: boolean;
  chamado: ChamadoRow | null;
  /** Mensagem e histórico, buscados quando o modal abre. `null` = carregando. */
  detalhe: DetalheChamado | null;
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
