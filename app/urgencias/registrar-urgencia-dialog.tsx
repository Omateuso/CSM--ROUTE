"use client";

import { useActionState, useId, useMemo, useState, type ClipboardEvent, type FormEvent } from "react";
import {
  buscarChamadosParaUrgencia,
  buscarChamadosPorProtocolos,
  registrarUrgenciasEmLote,
  type ChamadoParaUrgencia,
  type ItemLote,
  type ResultadoLote,
} from "./actions";
import { extrairProtocolos } from "./extrair-protocolos";
import { PrioridadeBadge } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { StatusChamadoBadge } from "@/app/chamados/status-chamado-badge";
import { URGENCIA_ORIGEM_OPTIONS } from "./urgencia-origem";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";
import { PlacaRt } from "@/lib/ui/placa-rt";

// Modelo "chamado primeiro" (migration 0045): a Central de Urgências nunca
// cadastra RT/assunto de novo — a urgência é registrada sobre um chamado JÁ
// existente.
//
// Barra de REGISTRO, não só de busca (pedido do usuário, 17/09/2026): o
// gerente cola a mensagem crua do WhatsApp (carimbo de hora, nome, "eles são
// urgentes", tudo junto) ou digita um protocolo e aperta Enter, e os
// chamados entram num LOTE. Um formulário só (origem + solicitante + anexo)
// registra todos de uma vez; o motivo de cada um é o texto que veio colado
// na linha dele. Texto sem protocolo continua funcionando como busca por
// assunto/RT, e o resultado clicado entra no mesmo lote.
export function RegistrarUrgenciaDialog({
  open,
  onClose,
  onRegistrada,
}: {
  open: boolean;
  onClose: () => void;
  onRegistrada: (urgenciaId: string) => void;
}) {
  // `key` força o LoteUrgencias a remontar do zero a cada abertura — zera
  // lote, busca e resultado sem precisar de reset manual campo a campo.
  const [sessao, setSessao] = useState(0);

  function handleClose() {
    setSessao((s) => s + 1);
    onClose();
  }

  return (
    <Modal open={open} title="Registrar urgência" onClose={handleClose}>
      <LoteUrgencias key={sessao} onClose={handleClose} onRegistrada={onRegistrada} />
    </Modal>
  );
}

const SITUACAO_LABEL: Record<Exclude<ItemLote["situacao"], "ok">, string> = {
  nao_encontrado: "não encontrado no sistema — confira o número ou sincronize o TomTicket",
  ja_tem_urgencia: "já tem uma urgência em andamento",
  encerrado: "chamado já encerrado",
};

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function LoteUrgencias({ onClose, onRegistrada }: { onClose: () => void; onRegistrada: (urgenciaId: string) => void }) {
  const uid = useId();
  const idBarra = `${uid}-barra`;
  const idSolicitante = `${uid}-solicitante`;
  const idAnexo = `${uid}-anexo`;

  const [texto, setTexto] = useState("");
  const [lote, setLote] = useState<ItemLote[]>([]);
  const [resumo, setResumo] = useState<{ ignoradas: number; repetidos: number } | null>(null);
  const [resultadosBusca, setResultadosBusca] = useState<ChamadoParaUrgencia[] | null>(null);
  const [processando, setProcessando] = useState(false);

  const [state, formAction, isPending] = useActionState<ResultadoLote, FormData>(registrarUrgenciasEmLote, {
    error: null,
  });
  const [mostrarResultado, setMostrarResultado] = useState(false);
  useCloseOnSuccess(isPending, state.error, () => {
    // 1 urgência sem falha: mesmo comportamento de sempre, abre o detalhe dela.
    // Lote com mais de 1 (ou com alguma falha): mostra o resumo antes de fechar,
    // senão o gerente não fica sabendo o que entrou e o que não entrou.
    if (state.urgenciaId && (state.falhas?.length ?? 0) === 0) {
      onRegistrada(state.urgenciaId);
      onClose();
      return;
    }
    setMostrarResultado(true);
  });

  const registraveis = useMemo(() => lote.filter((i) => i.situacao === "ok"), [lote]);
  const naoRegistraveis = useMemo(() => lote.filter((i) => i.situacao !== "ok"), [lote]);

  // O que vai pro servidor: só os "ok", com o motivo efetivo — o texto colado
  // da linha, ou o assunto do chamado quando só veio o número (motivo é
  // obrigatório em fn_registrar_urgencia, nunca pode ir vazio).
  const itensParaEnviar = useMemo(
    () =>
      registraveis.map((i) => ({
        chamadoId: i.chamado!.id,
        protocolo: i.protocolo,
        motivo: i.motivo || i.chamado!.assunto,
      })),
    [registraveis],
  );

  async function incorporar(textoBruto: string) {
    const extracao = extrairProtocolos(textoBruto);
    if (extracao.itens.length === 0) return false;

    setProcessando(true);
    // Protocolo que já está no lote não é reconsultado nem duplicado —
    // colar a mesma mensagem duas vezes (aconteceu no exemplo real) não
    // pode dobrar a lista.
    const jaNoLote = new Set(lote.map((i) => i.protocolo));
    const novos = extracao.itens.filter((i) => !jaNoLote.has(i.protocolo));
    const repetidosNoLote = extracao.itens.length - novos.length;

    const resolvidos = novos.length > 0 ? await buscarChamadosPorProtocolos(novos) : [];
    setLote((atual) => [...atual, ...resolvidos]);
    setResumo({ ignoradas: extracao.linhasIgnoradas, repetidos: extracao.repetidos + repetidosNoLote });
    setResultadosBusca(null);
    setTexto("");
    setProcessando(false);
    return true;
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const colado = event.clipboardData.getData("text");
    if (extrairProtocolos(colado).itens.length === 0) return; // sem protocolo: cola normal, vira busca
    event.preventDefault();
    void incorporar(colado);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const termo = texto.trim();
    if (termo.length < 2 || processando) return;

    if (await incorporar(termo)) return;

    // Sem protocolo no texto: busca por assunto / código da RT, como antes.
    setProcessando(true);
    setResultadosBusca(await buscarChamadosParaUrgencia(termo));
    setProcessando(false);
  }

  function adicionarDaBusca(chamado: ChamadoParaUrgencia) {
    setLote((atual) => {
      if (atual.some((i) => i.chamado?.id === chamado.id)) return atual;
      return [...atual, { protocolo: chamado.tomticketId ?? chamado.id, motivo: "", situacao: "ok", chamado }];
    });
    setResultadosBusca(null);
    setTexto("");
  }

  function remover(protocolo: string) {
    setLote((atual) => atual.filter((i) => i.protocolo !== protocolo));
  }

  if (mostrarResultado) {
    return <ResumoDoLote resultado={state} onClose={onClose} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={idBarra} className={FIELD_LABEL}>
            Cole a mensagem ou digite o protocolo
          </label>
          <input
            id={idBarra}
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onPaste={handlePaste}
            placeholder="Cole o texto do WhatsApp, ou digite 322810 / SRT 22 / vazamento e aperte Enter"
            autoFocus
            className={FIELD_INPUT}
          />
        </div>
        <button
          type="submit"
          disabled={processando || texto.trim().length < 2}
          className={`rounded-[var(--radius-sm)] bg-accent px-4 py-1.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {processando ? "..." : "Adicionar"}
        </button>
      </form>

      <p className="text-xs text-text-tertiary">
        Aceita a mensagem inteira, com hora, nome e saudação — só os números de protocolo contam, o resto é
        ignorado. O texto que vier na mesma linha do protocolo vira o motivo da urgência.
      </p>

      {resumo && (resumo.ignoradas > 0 || resumo.repetidos > 0) && (
        <p className="text-xs text-text-tertiary">
          {resumo.repetidos > 0 && `${resumo.repetidos} protocolo(s) repetido(s) descartado(s)`}
          {resumo.repetidos > 0 && resumo.ignoradas > 0 && " · "}
          {resumo.ignoradas > 0 && `${resumo.ignoradas} linha(s) sem protocolo ignorada(s)`}
        </p>
      )}

      {resultadosBusca !== null && (
        <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
          {resultadosBusca.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-surface-input px-4 py-6 text-center text-xs text-text-tertiary">
              Nenhum chamado aberto encontrado com esse termo. Chamados já encerrados ou que já têm uma urgência em
              andamento não aparecem aqui.
            </p>
          ) : (
            resultadosBusca.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => adicionarDaBusca(c)}
                className={`flex flex-col gap-1 rounded-[var(--radius-sm)] border border-border p-3 text-left transition-colors hover:border-accent hover:bg-surface-input ${FOCUS_RING}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <PlacaRt codigo={c.rtCodigo} />
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

      {naoRegistraveis.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 p-3">
          <p className="text-xs font-semibold text-danger">Não dá pra registrar ({naoRegistraveis.length})</p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {naoRegistraveis.map((i) => (
              <li key={i.protocolo} className="flex items-baseline gap-2 text-xs text-text-secondary">
                <span className="font-mono">#{i.protocolo}</span>
                <span>— {SITUACAO_LABEL[i.situacao as keyof typeof SITUACAO_LABEL]}</span>
                {i.chamado && <span className="text-text-tertiary">({i.chamado.rtCodigo})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {registraveis.length === 1 ? (
        <CartaoChamado item={registraveis[0]} onRemover={() => remover(registraveis[0].protocolo)} />
      ) : registraveis.length > 1 ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-text-primary">No lote ({registraveis.length})</p>
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {registraveis.map((i) => (
              <li
                key={i.protocolo}
                className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PlacaRt codigo={i.chamado!.rtCodigo} />
                    {i.chamado!.tomticketId && (
                      <span className="font-mono text-xs text-text-tertiary">#{i.chamado!.tomticketId}</span>
                    )}
                    <PrioridadeBadge prioridade={i.chamado!.prioridade} />
                  </div>
                  <p className="truncate text-sm text-text-primary">{i.chamado!.assunto}</p>
                  <p className="text-xs text-text-tertiary">
                    <span className="font-medium">motivo:</span> {i.motivo || i.chamado!.assunto}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remover(i.protocolo)}
                  aria-label={`Tirar #${i.protocolo} do lote`}
                  className={`shrink-0 rounded-[var(--radius-sm)] px-2 py-1 text-xs text-text-tertiary hover:bg-surface hover:text-danger ${FOCUS_RING}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {registraveis.length > 0 && (
        <form action={formAction} className="flex flex-col gap-4 border-t border-border pt-4">
          <input type="hidden" name="itens" value={JSON.stringify(itensParaEnviar)} />

          <p className="text-xs text-text-tertiary">
            Prioridade do TomTicket nunca é alterada por registrar uma urgência — o que muda aqui é só o
            tratamento operacional.
          </p>

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

          <div className="mt-1 flex items-center justify-end gap-3">
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
              className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              {isPending
                ? "Registrando..."
                : registraveis.length === 1
                  ? "Registrar urgência"
                  : `Registrar ${registraveis.length} urgências`}
            </button>
          </div>
        </form>
      )}

      {registraveis.length === 0 && (
        <div className="flex justify-end border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className={`text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING}`}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// Lote de 1 mostra o chamado inteiro (descrição, SLA, endereço) — é o caso
// comum e era o que a tela já fazia; a linha compacta fica pro lote grande.
function CartaoChamado({ item, onRemover }: { item: ItemLote; onRemover: () => void }) {
  const chamado = item.chamado!;
  return (
    <div className="rounded-[var(--radius-md)] bg-surface shadow-lift-input p-3">
      <div className="flex flex-wrap items-center gap-2">
        <PlacaRt codigo={chamado.rtCodigo} />
        {chamado.tomticketId && <span className="font-mono text-xs text-text-tertiary">#{chamado.tomticketId}</span>}
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
      <p className="mt-2 text-xs text-text-secondary">
        <span className="font-medium">Motivo da urgência:</span> {item.motivo || chamado.assunto}
      </p>
      <button
        type="button"
        onClick={onRemover}
        className={`mt-2 text-xs font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
      >
        ← Trocar chamado
      </button>
    </div>
  );
}

function ResumoDoLote({ resultado, onClose }: { resultado: ResultadoLote; onClose: () => void }) {
  const falhas = resultado.falhas ?? [];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-text-primary">
        {resultado.registradas === 1 ? "1 urgência registrada" : `${resultado.registradas} urgências registradas`}
        {falhas.length > 0 && ` · ${falhas.length} não ${falhas.length === 1 ? "entrou" : "entraram"}`}
      </p>
      {falhas.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-danger/30 bg-danger/5 p-3">
          {falhas.map((f) => (
            <li key={f.protocolo} className="text-xs text-text-secondary">
              <span className="font-mono">#{f.protocolo}</span> — {f.erro}
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end border-t border-border pt-4">
        <button
          type="button"
          onClick={onClose}
          className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover ${FOCUS_RING}`}
        >
          Concluir
        </button>
      </div>
    </div>
  );
}
