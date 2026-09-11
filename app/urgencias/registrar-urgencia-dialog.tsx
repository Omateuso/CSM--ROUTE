"use client";

import { useActionState, useId, useState, type FormEvent } from "react";
import { registrarUrgencia, buscarChamadosParaUrgencia, type ActionState, type ChamadoParaUrgencia } from "./actions";
import { PrioridadeBadge } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { StatusChamadoBadge } from "@/app/chamados/status-chamado-badge";
import { URGENCIA_ORIGEM_OPTIONS } from "./urgencia-origem";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";

// Modelo "chamado primeiro" (migration 0045, 11/09/2026): a Central de
// Urgências nunca cadastra RT/assunto/descrição de novo — o gerente busca um
// chamado JÁ existente (protocolo, assunto ou código da RT) e registra a
// urgência em cima dele. Dois passos dentro do mesmo diálogo: buscar +
// escolher, depois confirmar motivo/origem/solicitante.
export function RegistrarUrgenciaDialog({
  open,
  onClose,
  onRegistrada,
}: {
  open: boolean;
  onClose: () => void;
  onRegistrada: (urgenciaId: string) => void;
}) {
  const [chamado, setChamado] = useState<ChamadoParaUrgencia | null>(null);

  function handleClose() {
    setChamado(null);
    onClose();
  }

  return (
    <Modal open={open} title="Registrar urgência" onClose={handleClose}>
      {chamado === null ? (
        <BuscarChamado onSelecionar={setChamado} onCancelar={handleClose} />
      ) : (
        <ConfirmarUrgencia
          chamado={chamado}
          onVoltar={() => setChamado(null)}
          onClose={handleClose}
          onRegistrada={onRegistrada}
        />
      )}
    </Modal>
  );
}

function BuscarChamado({
  onSelecionar,
  onCancelar,
}: {
  onSelecionar: (chamado: ChamadoParaUrgencia) => void;
  onCancelar: () => void;
}) {
  const idBusca = useId();
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ChamadoParaUrgencia[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  async function handleBuscar(event: FormEvent) {
    event.preventDefault();
    if (busca.trim().length < 2) return;
    setBuscando(true);
    const encontrados = await buscarChamadosParaUrgencia(busca);
    setResultados(encontrados);
    setBuscando(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Busque o chamado que já existe (protocolo, assunto ou código da RT) — a urgência é registrada em cima dele,
        sem recadastrar nada.
      </p>

      <form onSubmit={handleBuscar} className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={idBusca} className={FIELD_LABEL}>
            Buscar chamado
          </label>
          <input
            id={idBusca}
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex.: 322810, SRT 22, vazamento..."
            autoFocus
            className={FIELD_INPUT}
          />
        </div>
        <button
          type="submit"
          disabled={buscando || busca.trim().length < 2}
          className={`rounded-[var(--radius-sm)] bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {resultados !== null && (
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {resultados.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-surface-input px-4 py-6 text-center text-xs text-text-tertiary">
              Nenhum chamado aberto encontrado com esse termo. Chamados já encerrados ou que já têm uma urgência em
              andamento não aparecem aqui.
            </p>
          ) : (
            resultados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelecionar(c)}
                className={`flex flex-col gap-1 rounded-[var(--radius-sm)] border border-border p-3 text-left transition-colors hover:border-accent hover:bg-surface-input ${FOCUS_RING}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-text-secondary">{c.rtCodigo}</span>
                  {c.tomticketId && <span className="font-mono text-xs text-text-tertiary">#{c.tomticketId}</span>}
                  <span className="ml-auto">
                    <PrioridadeBadge prioridade={c.prioridade} />
                  </span>
                </div>
                <p className="text-sm font-medium text-text-primary">{c.assunto}</p>
                <p className="text-xs text-text-tertiary">
                  {c.rtEndereco} · {c.capsNome}
                </p>
              </button>
            ))
          )}
        </div>
      )}

      <div className="flex justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={onCancelar}
          className={`text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING}`}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function ConfirmarUrgencia({
  chamado,
  onVoltar,
  onClose,
  onRegistrada,
}: {
  chamado: ChamadoParaUrgencia;
  onVoltar: () => void;
  onClose: () => void;
  onRegistrada: (urgenciaId: string) => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(registrarUrgencia, { error: null });
  useCloseOnSuccess(isPending, state.error, () => {
    if (state.urgenciaId) onRegistrada(state.urgenciaId);
    onClose();
  });

  const uid = useId();
  const idMotivo = `${uid}-motivo`;
  const idSolicitante = `${uid}-solicitante`;
  const idAnexo = `${uid}-anexo`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="chamadoId" value={chamado.id} />

      <div className="rounded-[var(--radius-md)] border border-border bg-surface-input p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-text-primary">{chamado.rtCodigo}</span>
          {chamado.tomticketId && (
            <span className="font-mono text-xs text-text-tertiary">#{chamado.tomticketId}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <PrioridadeBadge prioridade={chamado.prioridade} />
            <SlaBadge slaPrazo={chamado.slaPrazo} status={chamado.status} />
            <StatusChamadoBadge status={chamado.status} />
          </div>
        </div>
        <p className="mt-1 text-sm font-medium text-text-primary">{chamado.assunto}</p>
        <p className="mt-1 text-xs text-text-tertiary">
          {chamado.rtEndereco} · {chamado.capsNome} · {chamado.regiaoNome}
        </p>
        <p className="mt-1 text-xs text-text-tertiary">Aberto em {formatoData.format(new Date(chamado.criadoEm))}</p>
        {chamado.descricao && (
          <p className="mt-2 max-h-24 overflow-y-auto rounded-[var(--radius-sm)] border border-border bg-surface p-2 text-xs whitespace-pre-wrap text-text-secondary">
            {chamado.descricao}
          </p>
        )}
        <button
          type="button"
          onClick={onVoltar}
          className={`mt-2 text-xs font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
        >
          ← Trocar chamado
        </button>
      </div>

      <p className="text-xs text-text-tertiary">
        Prioridade do TomTicket mostrada acima — nunca é alterada por registrar uma urgência. O que muda aqui é só o
        tratamento operacional.
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor={idMotivo} className={FIELD_LABEL}>
          Motivo da urgência
        </label>
        <input
          id={idMotivo}
          name="motivo"
          type="text"
          placeholder="Por que não pode esperar a próxima rota"
          required
          className={FIELD_INPUT}
        />
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className={FIELD_LABEL}>Origem</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
          {URGENCIA_ORIGEM_OPTIONS.map((o, indice) => (
            <label key={o.value} className="flex items-center gap-1.5 text-sm text-text-primary">
              <input type="radio" name="origem" value={o.value} required defaultChecked={indice === 0} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={idSolicitante} className={FIELD_LABEL}>
            Solicitante
          </label>
          <input
            id={idSolicitante}
            name="solicitante"
            type="text"
            placeholder="Quem relatou"
            required
            className={FIELD_INPUT}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idAnexo} className={FIELD_LABEL}>
            Anexo (opcional)
          </label>
          <input id={idAnexo} name="anexo" type="file" accept="image/*,application/pdf" className={FIELD_INPUT} />
        </div>
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
          {isPending ? "Registrando..." : "Registrar urgência"}
        </button>
      </div>
    </form>
  );
}
