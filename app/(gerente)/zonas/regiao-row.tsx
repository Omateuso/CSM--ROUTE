"use client";

import { useState } from "react";
import { renomearRegiao, excluirRegiao } from "./actions";
import { InlineTextForm } from "./inline-text-form";
import { DeleteTrigger, ConfirmDeleteBar } from "./confirm-delete";
import { FOCUS_RING, TAP_TARGET } from "@/lib/ui/styles";

export function RegiaoRow({ id, nome }: { id: string; nome: string }) {
  const [modo, setModo] = useState<"visualizando" | "editando" | "excluindo">("visualizando");

  if (modo === "editando") {
    return (
      <li className="py-2">
        <InlineTextForm
          action={renomearRegiao}
          hiddenFields={{ id }}
          defaultValue={nome}
          label={`Renomear região ${nome}`}
          placeholder="Nome da região"
          submitLabel="Salvar"
          onCancel={() => setModo("visualizando")}
          onSuccess={() => setModo("visualizando")}
        />
      </li>
    );
  }

  if (modo === "excluindo") {
    return (
      <li className="py-2">
        <ConfirmDeleteBar
          action={excluirRegiao}
          id={id}
          onCancel={() => setModo("visualizando")}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-text-primary">{nome}</span>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setModo("editando")}
          aria-label={`Renomear região ${nome}`}
          className={`text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING} ${TAP_TARGET}`}
        >
          Renomear
        </button>
        <DeleteTrigger onClick={() => setModo("excluindo")} ariaLabel={`Excluir região ${nome}`} />
      </div>
    </li>
  );
}
