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
// Áudio + transcrição (pedido do usuário, 15/09/2026, `gravarAudio`): pra
// relatar o que foi feito (atendimento/revisão), além do texto, a GRAVAÇÃO em
// si também é guardada — o gerente pode ouvir o relato original, não só ler o
// que a transcrição entendeu (que erra nome próprio, jargão, etc.). Grava com
// `MediaRecorder` (getUserMedia próprio, independente do que o
// SpeechRecognition já usa por baixo — os dois coexistem sem conflito nos
// navegadores testados) ao mesmo tempo que a transcrição roda. É reforço, não
// substituto: falha silenciosa de áudio (sem suporte, permissão negada) nunca
// bloqueia a transcrição nem o campo de texto, que continuam funcionando.
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

// Extensão/tipo MIME que o MediaRecorder consegue de fato produzir varia por
// navegador — webm/opus (Chrome/Edge/Firefox, o caso comum em Android) ou
// mp4/aac (Safari/iOS). Pede em ordem de preferência e deixa o navegador
// escolher o que ele suporta; sem nenhum dos dois, grava sem `mimeType`
// explícito (o padrão do navegador, ainda assim funcional).
const MIME_AUDIO_PREFERIDOS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function escolherMimeAudio(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_AUDIO_PREFERIDOS.find((t) => MediaRecorder.isTypeSupported(t));
}

type Props = {
  id?: string;
  name: string;
  label: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  /** Além de transcrever, guarda a gravação em si como evidência (migration
   * 0051) — pro relato do que foi feito no atendimento/revisão. */
  gravarAudio?: boolean;
  /** Nome do campo oculto que carrega o arquivo de áudio no FormData. Default
   * `${name}Audio`. Só importa quando `gravarAudio` é true. */
  nomeAudio?: string;
};

export function CampoTranscricao({
  id,
  name,
  label,
  required,
  rows = 4,
  placeholder,
  gravarAudio = false,
  nomeAudio,
}: Props) {
  const uid = useId();
  const campoId = id ?? uid;
  const campoNomeAudio = nomeAudio ?? `${name}Audio`;

  const [valor, setValor] = useState("");
  const [gravando, setGravando] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const suportado = useSyncExternalStore(inscreverSemEventos, snapshotSuporte, snapshotSuporteNoServidor);
  const reconhecimentoRef = useRef<ReconhecimentoDeFala | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const hiddenAudioInputRef = useRef<HTMLInputElement>(null);

  // Limpeza: parar o microfone (dos dois lados) e liberar a URL de preview
  // se o componente sair de tela gravando — sem setState aqui, não esbarra
  // na regra de state-in-effect.
  useEffect(() => {
    return () => {
      reconhecimentoRef.current?.stop();
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só limpeza no unmount, não deve re-rodar a cada troca de audioUrl
  }, []);

  async function iniciarGravacaoAudio() {
    if (!gravarAudio) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = escolherMimeAudio();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32000 } : undefined);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const extensao = blob.type.includes("mp4") ? "m4a" : "webm";
        const arquivo = new File([blob], `relato-${Date.now()}.${extensao}`, { type: blob.type });

        const dt = new DataTransfer();
        dt.items.add(arquivo);
        if (hiddenAudioInputRef.current) hiddenAudioInputRef.current.files = dt.files;

        setAudioUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });

        stream.getTracks().forEach((t) => t.stop());
      };

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch {
      // Sem permissão de microfone (separada da que o SpeechRecognition já
      // usa) ou sem MediaRecorder no navegador — a transcrição continua
      // funcionando normalmente, só não sobra gravação pra anexar.
    }
  }

  function alternarGravacao() {
    if (gravando) {
      reconhecimentoRef.current?.stop();
      mediaRecorderRef.current?.stop();
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
    void iniciarGravacaoAudio();
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

      {gravarAudio && (
        <>
          {/* Recebe o Blob gravado via DataTransfer (mesmo truque do
              CameraCaptureField) — viaja no FormData junto com o texto. */}
          <input ref={hiddenAudioInputRef} type="file" name={campoNomeAudio} className="hidden" tabIndex={-1} aria-hidden="true" />
          {audioUrl && !gravando && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-text-tertiary">🎧 Áudio do relato:</span>
              <audio src={audioUrl} controls className="h-8 max-w-[220px]" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
