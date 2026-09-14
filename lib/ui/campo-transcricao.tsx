"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { FIELD_INPUT, FIELD_LABEL, FOCUS_RING } from "./styles";

// Campo de texto com opção de ditado por voz (pedido do usuário, 14/09/2026):
// em todo campo de escrever do técnico, ele pode falar em vez de digitar — o
// texto transcrito entra no mesmo textarea que o gerente lê depois. Usa a
// Web Speech API nativa do navegador (SpeechRecognition/webkitSpeechRecognition)
// — sem custo de API nenhum, mesma filosofia "grátis primeiro" já usada em
// mapas/rotas. Suporte real hoje é essencialmente Chrome/Edge (inclui Android,
// o SO mais provável do celular do técnico em campo); Safari/Firefox não têm
// a API ou têm parcial — nesse caso o botão de microfone simplesmente não
// aparece (degradação graciosa, o técnico ainda digita normalmente).
//
// Tipagem própria em vez de depender do `lib.dom.d.ts` do TypeScript ter (ou
// não) `SpeechRecognition`/o prefixo `webkit` — isso varia por versão do TS
// instalado e não é o suficiente pra confiar sozinho.
type ResultadoFala = { transcript: string };
type EventoResultadoFala = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<ResultadoFala>>;
};
interface ReconhecimentoDeFala {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: EventoResultadoFala) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type ConstrutorReconhecimento = new () => ReconhecimentoDeFala;

function obterConstrutorReconhecimento(): ConstrutorReconhecimento | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Suporte do navegador não muda durante a vida da página — não há evento
// pra assinar, só um valor que difere entre servidor (sempre `false`, sem
// `window`) e cliente. `useSyncExternalStore` é o jeito correto de revelar
// esse valor sem cair na regra `react-hooks/set-state-in-effect` (setState
// direto dentro de um efeito) nem gerar aviso de hidratação — React já sabe
// tratar essa divergência entre os dois snapshots.
function inscreverSemEventos() {
  return () => {};
}
function snapshotSuporte(): boolean {
  return obterConstrutorReconhecimento() !== null;
}
function snapshotSuporteNoServidor(): boolean {
  return false;
}

type Props = {
  id?: string;
  name: string;
  label: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
};

export function CampoTranscricao({ id, name, label, required, rows = 4, placeholder }: Props) {
  const uid = useId();
  const campoId = id ?? uid;

  const [valor, setValor] = useState("");
  const [gravando, setGravando] = useState(false);
  const suportado = useSyncExternalStore(inscreverSemEventos, snapshotSuporte, snapshotSuporteNoServidor);
  const reconhecimentoRef = useRef<ReconhecimentoDeFala | null>(null);

  // Só a limpeza (parar o microfone se o componente sair de tela gravando) —
  // sem setState aqui, então não esbarra na mesma regra.
  useEffect(() => {
    return () => {
      reconhecimentoRef.current?.stop();
    };
  }, []);

  function alternarGravacao() {
    if (gravando) {
      reconhecimentoRef.current?.stop();
      return;
    }

    const Construtor = obterConstrutorReconhecimento();
    if (!Construtor) return;

    const reconhecimento = new Construtor();
    reconhecimento.lang = "pt-BR";
    reconhecimento.continuous = true;
    reconhecimento.interimResults = false;

    reconhecimento.onresult = (ev) => {
      let trechoNovo = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        trechoNovo += ev.results[i][0].transcript;
      }
      trechoNovo = trechoNovo.trim();
      if (!trechoNovo) return;
      setValor((atual) => (atual.trim() ? `${atual.trim()} ${trechoNovo}` : trechoNovo));
    };
    reconhecimento.onend = () => setGravando(false);
    reconhecimento.onerror = () => setGravando(false);

    reconhecimentoRef.current = reconhecimento;
    reconhecimento.start();
    setGravando(true);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={campoId} className={FIELD_LABEL}>
          {label}
        </label>
        {suportado && (
          <button
            type="button"
            onClick={alternarGravacao}
            aria-pressed={gravando}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              gravando
                ? "bg-priority-emergencial/15 text-priority-emergencial"
                : "bg-accent/10 text-accent hover:bg-accent/15"
            } ${FOCUS_RING}`}
          >
            <span aria-hidden="true">{gravando ? "⏹" : "🎤"}</span>
            {gravando ? "Parar" : "Falar"}
          </button>
        )}
      </div>
      <textarea
        id={campoId}
        name={name}
        required={required}
        rows={rows}
        placeholder={placeholder}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className={`${FIELD_INPUT} resize-none`}
      />
      {gravando && (
        <p role="status" className="text-xs text-accent">
          🎙️ Ouvindo... fale e toque em &ldquo;Parar&rdquo; quando terminar.
        </p>
      )}
    </div>
  );
}
