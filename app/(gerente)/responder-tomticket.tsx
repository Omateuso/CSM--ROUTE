"use client";

import { useActionState, useId, useState } from "react";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FIELD_INPUT, FIELD_LABEL, FOCUS_RING } from "@/lib/ui/styles";
import { TOMTICKET_MAX_MENSAGEM } from "@/lib/tomticket/config";
import { responderChamadoTomticket, type RespostaState } from "./tomticket-actions";

const RESPOSTA_INICIAL: RespostaState = { error: null, aviso: null, ok: false };

// Diálogo compartilhado pelas duas telas que respondem no TomTicket:
// Validação (conclusão) e Pendências. Um componente só, dois presets — o que
// muda é o texto pré-preenchido e o rótulo do botão.
//
// A mensagem vem PRONTA do servidor (`mensagemPadrao`), não é montada aqui: a
// saudação depende da hora, e gerar dos dois lados abriria descasamento de
// hidratação.

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export type ResponderTomticketProps = {
  servicoId: string;
  tipo: "conclusao" | "pendencia" | "revisao";
  mensagemPadrao: string;
  /** Rótulos dos arquivos que vão junto, ex.: ["Foto antes", "Foto depois", "OS"]. */
  anexos: string[];
  rotuloBotao: string;
  tituloModal: string;
  /** Já respondido (há recibo em servicos.tomticket_resposta_id) — vira estado, não botão. */
  respondido: boolean;
  /** Quando foi respondido, do histórico. Pode faltar; aí o selo vai sem data. */
  respondidoEm?: string | null;
  /** Selo vermelho de localização: pede uma confirmação extra, mas não bloqueia. */
  localizacaoDivergente?: boolean;
  integracaoAtiva: boolean;
  /** "amarelo" na aba Validação (pedido do usuário, 14/09/2026) — Pendências
   * continua com o accent de sempre, sem passar essa prop. */
  cor?: "accent" | "amarelo";
};

export function ResponderTomticket(props: ResponderTomticketProps) {
  const [aberto, setAberto] = useState(false);

  if (props.respondido) {
    return (
      <span className="text-xs font-medium text-success">
        ✓ Respondido no TomTicket
        {props.respondidoEm ? ` em ${formatoDataHora.format(new Date(props.respondidoEm))}` : ""}
      </span>
    );
  }

  // Sem token, não renderiza NADA: a mensagem "indisponível" se repetia em todo
  // card e virava ruído, sem o gerente poder fazer nada a respeito. A tela fica
  // como era antes da integração (o link "Ir para o TomTicket" continua ali), e
  // os botões aparecem sozinhos quando o TOMTICKET_TOKEN for configurado.
  if (!props.integracaoAtiva) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`rounded-[var(--radius-sm)] px-4 py-2 text-sm font-medium transition-colors ${
          props.cor === "amarelo"
            ? "bg-sla-proximo text-on-accent hover:opacity-90"
            : "bg-accent text-on-accent hover:bg-accent-hover"
        } ${FOCUS_RING}`}
      >
        {props.rotuloBotao}
      </button>

      {/* Remonta a cada abertura pra o textarea voltar ao texto padrão
          (o Modal documenta que isso é responsabilidade do pai). */}
      <ResponderDialog
        key={aberto ? "aberto" : "fechado"}
        {...props}
        open={aberto}
        onClose={() => setAberto(false)}
      />
    </>
  );
}

function ResponderDialog({
  open,
  onClose,
  servicoId,
  tipo,
  mensagemPadrao,
  anexos,
  tituloModal,
  localizacaoDivergente,
}: ResponderTomticketProps & { open: boolean; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<RespostaState, FormData>(
    responderChamadoTomticket,
    RESPOSTA_INICIAL,
  );
  // Um aviso mantém o diálogo aberto de propósito: ele diz que a mensagem foi
  // enviada mas algo não pôde ser confirmado, e o gerente precisa ler isso.
  useCloseOnSuccess(isPending, state.error ?? state.aviso, onClose);

  const [mensagem, setMensagem] = useState(mensagemPadrao);
  const idMensagem = useId();

  const editada = mensagem !== mensagemPadrao;
  const excedeu = mensagem.length > TOMTICKET_MAX_MENSAGEM;
  const vazia = mensagem.trim() === "";

  return (
    <Modal open={open} title={tituloModal} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="servicoId" value={servicoId} />
        <input type="hidden" name="tipo" value={tipo} />

        <p className="text-sm text-text-secondary">
          A mensagem abaixo será enviada ao chamado no TomTicket, com os anexos, em nome da CSM.
          Não é possível desfazer o envio.
        </p>

        {tipo === "conclusao" && (
          <p
            role="alert"
            className="rounded-[var(--radius-sm)] border border-priority-alta/40 bg-priority-alta/5 p-3 text-sm text-priority-alta"
          >
            ⚠️ O chamado será <strong>finalizado</strong> no TomTicket junto com o envio. Reabrir só
            manualmente por lá.
          </p>
        )}

        {localizacaoDivergente && (
          <p
            role="alert"
            className="rounded-[var(--radius-sm)] border border-danger/40 bg-danger/5 p-3 text-sm text-danger"
          >
            ⚠️ A localização da foto não confere com o endereço cadastrado da RT. Deseja enviar mesmo
            assim?
          </p>
        )}

        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={idMensagem} className={FIELD_LABEL}>
              Mensagem
            </label>
            {editada && (
              <button
                type="button"
                onClick={() => setMensagem(mensagemPadrao)}
                className={`text-xs font-medium text-accent transition-colors hover:text-accent-hover ${FOCUS_RING}`}
              >
                Restaurar mensagem padrão
              </button>
            )}
          </div>
          <textarea
            id={idMensagem}
            name="mensagem"
            required
            rows={10}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            className={`${FIELD_INPUT} resize-y`}
          />
          <p className={`text-right text-xs ${excedeu ? "text-danger" : "text-text-tertiary"}`}>
            {mensagem.length}/{TOMTICKET_MAX_MENSAGEM} caracteres
          </p>
        </div>

        <div className="rounded-[var(--radius-sm)] bg-surface-input p-3">
          <p className="text-xs font-medium text-text-secondary">
            {anexos.length > 0 ? "Vai junto no anexo:" : "Sem anexo."}
          </p>
          {anexos.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {anexos.map((anexo) => (
                <li key={anexo} className="text-xs text-text-tertiary">
                  {anexo}
                </li>
              ))}
            </ul>
          )}
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.aviso && (
          <p role="alert" className="text-sm text-priority-alta">
            {state.aviso}
          </p>
        )}

        <div className="mt-1 flex items-center justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={`text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING}`}
          >
            {state.aviso ? "Fechar" : "Cancelar"}
          </button>
          <button
            type="submit"
            disabled={isPending || excedeu || vazia || state.ok}
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isPending
              ? "Enviando..."
              : localizacaoDivergente
                ? "Enviar mesmo assim"
                : tipo === "conclusao"
                  ? "Enviar e finalizar"
                  : "Enviar ao TomTicket"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
