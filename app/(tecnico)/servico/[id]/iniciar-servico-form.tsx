"use client";

import { useActionState, useState } from "react";
import { iniciarServico, type ActionState } from "./actions";
import { CameraCaptureField } from "./camera-capture-field";
import { PRIMARY_ACTION_BUTTON } from "@/lib/ui/styles";

// Antes era só um botão ("Iniciar atendimento"). Migration 0023 (auditoria
// de segurança) passou a exigir foto "antes" pra liberar a transição
// planejado -> em_execucao — virou um form com o mesmo CameraCaptureField
// usado na conclusão.
export function IniciarServicoForm({ servicoId }: { servicoId: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(iniciarServico, {
    error: null,
  });
  const [fotoPronta, setFotoPronta] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="servicoId" value={servicoId} />

      <CameraCaptureField name="fotoAntes" label="Foto de antes do atendimento" onReadyChange={setFotoPronta} />

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={isPending || !fotoPronta} className={PRIMARY_ACTION_BUTTON}>
        {isPending ? "Iniciando..." : "Iniciar atendimento"}
      </button>
    </form>
  );
}
