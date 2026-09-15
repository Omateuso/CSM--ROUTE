"use client";

import { useActionState, useId, useState } from "react";
import { concluirServico, type ActionState } from "./actions";
import { CameraCaptureField } from "./camera-capture-field";
import { OsAttachField } from "./os-attach-field";
import { CampoTranscricao } from "@/lib/ui/campo-transcricao";
import { PRIMARY_ACTION_BUTTON } from "@/lib/ui/styles";

export function ConcluirServicoForm({ servicoId }: { servicoId: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(concluirServico, {
    error: null,
  });
  const [fotoPronta, setFotoPronta] = useState(false);
  // OS é obrigatória no servidor (fn_concluir_servico) desde sempre, mas
  // até aqui só o atributo `required` do input cuidava disso — o botão só
  // reagia à foto, então ficava clicável mesmo sem OS (bloqueava só na
  // hora de enviar, com o aviso nativo do navegador). Achado real do
  // usuário testando no celular, 27/08/2026.
  const [osPronta, setOsPronta] = useState(false);

  const uid = useId();
  const idObservacao = `${uid}-observacao`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="servicoId" value={servicoId} />

      <CampoTranscricao
        id={idObservacao}
        name="observacao"
        label="O que foi feito"
        required
        rows={4}
        placeholder="Descreva o serviço realizado..."
        gravarAudio
        nomeAudio="audioObservacao"
      />

      {/* Migration 0023 (auditoria de segurança): foto "depois" voltou a
          ser obrigatória (reverte a 0017) — mesmo componente da tela de
          Iniciar, com geolocalização e carimbo. */}
      <CameraCaptureField name="fotoDepois" label="Foto de depois do atendimento" onReadyChange={setFotoPronta} />

      <OsAttachField name="os" onReadyChange={setOsPronta} />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={isPending || !fotoPronta || !osPronta} className={PRIMARY_ACTION_BUTTON}>
        {isPending ? "Enviando..." : "Concluir serviço"}
      </button>
    </form>
  );
}
