"use client";

import { useId, useRef, useState } from "react";
import { FIELD_LABEL } from "@/lib/ui/styles";
import { comprimirImagem } from "@/lib/ui/imagem-navegador";

// Campo de OS (foto ou PDF) — antes era um <input type="file"> cru em
// concluir-servico-form.tsx E pendencia-form.tsx (código duplicado nos
// dois), sem NENHUMA compressão quando o técnico fotografava a OS em vez
// de anexar um PDF. Achado real (usuário, 15/09/2026): mesmo depois de
// corrigir a foto principal (camera-capture-field.tsx), o "insuficiência
// de memória" continuava aparecendo ao CONCLUIR — a OS sem compressão,
// somada à foto + o áudio do relato (0051) na mesma submissão, ainda podia
// estourar num celular fraco. Mesmo tratamento de botão explícito que
// CameraCaptureField ganhou na mesma sessão ("Escolher arquivo" não convida
// a abrir a câmera).
type Props = {
  name: string;
  onReadyChange?: (ready: boolean) => void;
};

type Status = "vazio" | "processando" | "pronto" | "erro";

function IconeAnexo() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
    >
      <path d="M4 8a2 2 0 0 1 2-2h1.3l1-1.5h7.4l1 1.5H18a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.8" r="3.4" />
    </svg>
  );
}

export function OsAttachField({ name, onReadyChange }: Props) {
  const uid = useId();
  const inputId = `${uid}-os-picker`;
  const pickerRef = useRef<HTMLInputElement>(null);
  const hiddenFileRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<Status>("vazio");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite tocar de novo (trocar o arquivo) sem travar o onChange

    if (!file) return;

    setStatus("processando");
    onReadyChange?.(false);

    try {
      // PDF passa direto — comprimir imagem não se aplica; `comprimirImagem`
      // já é best-effort (cai pro arquivo original em qualquer falha), então
      // nunca bloqueia o envio da OS por causa da compressão em si.
      const final = file.type.startsWith("image/") ? await comprimirImagem(file) : file;

      const dt = new DataTransfer();
      dt.items.add(final);
      if (hiddenFileRef.current) hiddenFileRef.current.files = dt.files;

      setNomeArquivo(file.name);
      setStatus("pronto");
      onReadyChange?.(true);
    } catch {
      setStatus("erro");
      onReadyChange?.(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={FIELD_LABEL}>
        OS (foto ou PDF)
      </label>

      {/* Oculto — mesmo motivo de CameraCaptureField: o botão abaixo
          substitui o rótulo padrão do navegador ("Escolher arquivo"). */}
      <input
        ref={pickerRef}
        id={inputId}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={handlePick}
        className="hidden"
      />
      <input ref={hiddenFileRef} type="file" name={name} className="hidden" tabIndex={-1} aria-hidden="true" />

      <button
        type="button"
        onClick={() => pickerRef.current?.click()}
        disabled={status === "processando"}
        className="flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-accent bg-accent/5 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
      >
        <span aria-hidden="true">
          <IconeAnexo />
        </span>
        {status === "processando"
          ? "Processando..."
          : status === "pronto"
            ? "Trocar OS"
            : "Tire uma foto ou anexe a OS"}
      </button>

      {status === "erro" && (
        <p role="alert" className="text-xs text-danger">
          Não foi possível anexar. Tente de novo.
        </p>
      )}
      {status === "pronto" && nomeArquivo && <p className="text-xs text-text-tertiary">✓ {nomeArquivo}</p>}
    </div>
  );
}
