"use client";

import { useActionState, useId, useState } from "react";
import { revisarServico, type ActionState } from "./actions";
import { CameraCaptureField } from "./camera-capture-field";
import { CampoTranscricao } from "@/lib/ui/campo-transcricao";
import { FOCUS_RING } from "@/lib/ui/styles";

// Fluxo leve de revisão (migration 0047, 14/09/2026) — alternativa ao
// atendimento completo pra um chamado marcado `revisao_tecnica` (0046). O
// técnico tira 1 foto do local, escreve o que encontrou e o que falta pra
// concluir, e o chamado sai da lista dele — sem foto "antes"/"depois" nem OS
// (isso é só pro "Atender chamado", o fluxo completo de sempre).
export function RevisarServicoForm({ servicoId }: { servicoId: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(revisarServico, {
    error: null,
  });
  const [fotoPronta, setFotoPronta] = useState(false);

  const idDescricao = useId();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="servicoId" value={servicoId} />

      <p className="text-xs text-text-tertiary">
        Sem foto de antes/depois nem OS — é só pra registrar o que você encontrou. O chamado sai da sua
        lista e o gerente decide o que fazer a partir da sua descrição.
      </p>

      <CameraCaptureField name="fotoRevisao" label="Foto do local" onReadyChange={setFotoPronta} />

      <CampoTranscricao
        id={idDescricao}
        name="descricao"
        label="O que você encontrou e o que falta pra concluir"
        required
        rows={4}
        placeholder="Ex.: o vazamento é pequeno, precisa de um encanador pra trocar o registro; ou já foi resolvido por conta própria pelo morador..."
        gravarAudio
        nomeAudio="audioRelato"
      />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !fotoPronta}
        className={`w-full rounded-[var(--radius-sm)] bg-sla-proximo px-4 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
      >
        {isPending ? "Enviando..." : "Marcar como revisado"}
      </button>
    </form>
  );
}
