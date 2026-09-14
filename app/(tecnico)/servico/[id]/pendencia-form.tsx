"use client";

import { useActionState, useId, useState } from "react";
import { reportarPendencia, type ActionState } from "./actions";
import { CameraCaptureField } from "./camera-capture-field";
import { CampoTranscricao } from "@/lib/ui/campo-transcricao";
import { PENDENCIA_CATEGORIA_OPTIONS } from "@/lib/ui/pendencia-categoria";
import { FIELD_INPUT, FIELD_LABEL, FOCUS_RING } from "@/lib/ui/styles";

// Migration 0026: generaliza "falta de material" pra "pendência" — motivo
// vem de um select fechado (categoria) + descrição livre sempre
// obrigatória. Passou a exigir OS também, não só a foto do parcial: o
// técnico preenche a OS mesmo quando o atendimento não é concluído (é como
// ele documenta pro TomTicket de qualquer forma).
export function PendenciaForm({ servicoId }: { servicoId: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(reportarPendencia, {
    error: null,
  });
  const [fotoPronta, setFotoPronta] = useState(false);
  // Mesmo ajuste de concluir-servico-form.tsx (27/08/2026): OS já era
  // obrigatória no servidor, mas só o `required` nativo cuidava disso —
  // botão ficava clicável mesmo sem OS.
  const [osPronta, setOsPronta] = useState(false);

  const uid = useId();
  const idCategoria = `${uid}-categoria`;
  const idDescricao = `${uid}-descricao-pendencia`;
  const idOs = `${uid}-os-pendencia`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="servicoId" value={servicoId} />

      <p className="text-xs text-text-tertiary">
        O atendimento é cancelado e o chamado volta a ficar disponível pra uma próxima rota, com o que
        você já fez registrado.
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor={idCategoria} className={FIELD_LABEL}>
          Tipo de pendência
        </label>
        <select id={idCategoria} name="categoria" required defaultValue="" className={FIELD_INPUT}>
          <option value="" disabled>
            Selecione...
          </option>
          {PENDENCIA_CATEGORIA_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <CampoTranscricao
        id={idDescricao}
        name="descricao"
        label="O que já foi feito e detalhes da pendência"
        required
        rows={4}
        placeholder="Ex.: troquei o registro, mas falta a peça X pra fechar..."
      />

      <CameraCaptureField name="fotoParcial" label="Foto do que já foi feito" onReadyChange={setFotoPronta} />

      <div className="flex flex-col gap-1">
        <label htmlFor={idOs} className={FIELD_LABEL}>
          OS (foto ou PDF)
        </label>
        <input
          id={idOs}
          name="os"
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          required
          onChange={(e) => setOsPronta(!!e.target.files && e.target.files.length > 0)}
          className="text-sm text-text-secondary file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !fotoPronta || !osPronta}
        className={`w-full rounded-[var(--radius-sm)] bg-priority-alta px-4 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
      >
        {isPending ? "Enviando..." : "Reportar pendência"}
      </button>
    </form>
  );
}
