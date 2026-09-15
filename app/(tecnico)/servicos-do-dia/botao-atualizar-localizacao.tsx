"use client";

import { useState } from "react";
import { capturarGeolocalizacao } from "@/lib/geolocalizacao";
import { atualizarLocalizacaoEstimada } from "../localizacao-actions";
import { FOCUS_RING } from "@/lib/ui/styles";

// "Atualizar localização estimada" (pedido do usuário, 15/09/2026) — sob
// demanda, ao lado da captura automática de abertura do app
// (capturar-localizacao-inicial.tsx). Dá ao técnico controle explícito de
// quando atualizar, em vez de só confiar na captura silenciosa da abertura.
type Status = "ocioso" | "carregando" | "sucesso" | "erro";

export function BotaoAtualizarLocalizacao() {
  const [status, setStatus] = useState<Status>("ocioso");

  async function atualizar() {
    setStatus("carregando");
    try {
      const geo = await capturarGeolocalizacao();
      if (!geo) {
        setStatus("erro");
        return;
      }
      await atualizarLocalizacaoEstimada(geo.lat, geo.lng);
      setStatus("sucesso");
    } catch {
      setStatus("erro");
    }
  }

  return (
    <button
      type="button"
      onClick={atualizar}
      disabled={status === "carregando"}
      className={`flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border border-border px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-70 ${FOCUS_RING}`}
    >
      <span aria-hidden="true">📍</span>
      {status === "carregando"
        ? "Atualizando..."
        : status === "sucesso"
          ? "Localização atualizada"
          : status === "erro"
            ? "Não foi possível atualizar"
            : "Atualizar localização estimada"}
    </button>
  );
}
