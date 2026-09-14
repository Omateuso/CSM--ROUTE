"use client";

import { useState } from "react";
import { IniciarServicoForm } from "./iniciar-servico-form";
import { RevisarServicoForm } from "./revisar-servico-form";
import { FOCUS_RING } from "@/lib/ui/styles";

// Só pra serviço `revisao_tecnica` (0046) ainda `planejado` — pedido do
// usuário, 14/09/2026. Duas formas de tratar o chamado: revisar (foto +
// descrição, sem foto antes/depois nem OS, migration 0047 — atalho, aberto
// por padrão) ou atender completo (o "Iniciar atendimento" de sempre, com
// todos os passos padrão). O técnico escolhe, nunca as duas ao mesmo tempo.
export function RevisaoOuAtendimento({ servicoId }: { servicoId: string }) {
  const [modo, setModo] = useState<"revisar" | "atender">("revisar");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 rounded-[var(--radius-md)] bg-surface-input p-1">
        <button
          type="button"
          onClick={() => setModo("revisar")}
          aria-pressed={modo === "revisar"}
          className={`flex-1 rounded-[var(--radius-sm)] py-2 text-sm font-semibold transition-colors ${
            modo === "revisar" ? "bg-surface text-sla-proximo shadow-sm" : "text-text-tertiary"
          } ${FOCUS_RING}`}
        >
          Só revisar
        </button>
        <button
          type="button"
          onClick={() => setModo("atender")}
          aria-pressed={modo === "atender"}
          className={`flex-1 rounded-[var(--radius-sm)] py-2 text-sm font-semibold transition-colors ${
            modo === "atender" ? "bg-surface text-sla-dentro shadow-sm" : "text-text-tertiary"
          } ${FOCUS_RING}`}
        >
          Atender chamado
        </button>
      </div>

      {modo === "revisar" ? (
        <RevisarServicoForm servicoId={servicoId} />
      ) : (
        <IniciarServicoForm servicoId={servicoId} />
      )}
    </div>
  );
}
