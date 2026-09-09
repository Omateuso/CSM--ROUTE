"use client";

import { useActionState, useId, useState } from "react";
import { avaliarServico, type ActionState } from "./actions";
import { CameraCaptureField } from "./camera-capture-field";
import { FIELD_INPUT, FIELD_LABEL, FOCUS_RING } from "@/lib/ui/styles";

// Fase 4 (seção 7, migration 0037) — "avaliação do serviço antes de
// executar". O técnico aponta um problema no serviço (chamado já resolvido,
// RT errada, escopo diferente...) ANTES de iniciar. O serviço continua
// planejado — isto só avisa o gerente. Descrição livre + foto obrigatória
// (carimbada). Sem o tom de alerta laranja da Pendência de propósito: é um
// link discreto, não uma etapa.
export function AvaliarServicoForm({ servicoId }: { servicoId: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(avaliarServico, {
    error: null,
  });
  const [fotoPronta, setFotoPronta] = useState(false);

  const idDescricao = useId();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="servicoId" value={servicoId} />

      <p className="text-xs text-text-tertiary">
        O serviço não é iniciado nem cancelado — ele continua na sua lista. O gerente recebe o aviso e
        decide o que fazer.
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor={idDescricao} className={FIELD_LABEL}>
          Qual é o problema?
        </label>
        <textarea
          id={idDescricao}
          name="descricao"
          required
          rows={4}
          placeholder="Ex.: o morador diz que isso já foi resolvido pela equipe anterior; ou o endereço não confere; ou o chamado é de outra coisa..."
          className={`${FIELD_INPUT} resize-none`}
        />
      </div>

      <CameraCaptureField name="fotoAvaliacao" label="Foto do local / do problema" onReadyChange={setFotoPronta} />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !fotoPronta}
        className={`w-full rounded-[var(--radius-sm)] border border-border px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
      >
        {isPending ? "Enviando..." : "Enviar apontamento"}
      </button>
    </form>
  );
}
