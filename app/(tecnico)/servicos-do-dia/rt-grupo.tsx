"use client";

import { useState, type ReactNode } from "react";
import { FOCUS_RING } from "@/lib/ui/styles";

// Agrupa os serviços da rota por RT: o técnico clica em "SRT 50" e a lista de
// chamados daquela residência abre; clica de novo e volta a ser só "SRT 50".
//
// Antes, uma rota com 8 chamados na mesma RT virava 8 cards repetindo o mesmo
// código e o mesmo endereço — o técnico tinha que ler tudo pra saber quantas
// casas ia visitar.
//
// Começa FECHADO (pedido do usuário, 10/09/2026): a lista do dia pode ter
// muitas RTs, e cada grupo aberto empurra o resto pra baixo — abrir é sob
// demanda, na RT que o técnico vai atender agora.
export function RtGrupo({
  codigo,
  endereco,
  quantidade,
  children,
}: {
  codigo: string;
  endereco: string;
  quantidade: number;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(false);

  return (
    <li className="rounded-[var(--radius-md)] border border-border bg-surface">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className={`flex w-full items-center gap-2 rounded-[var(--radius-md)] p-4 text-left transition-colors hover:bg-surface-input ${FOCUS_RING}`}
      >
        <span aria-hidden="true" className="text-text-tertiary">
          {aberta ? "▾" : "▸"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-sm font-semibold text-text-primary">{codigo}</span>
          <span className="block truncate text-xs text-text-tertiary">{endereco}</span>
        </span>
        <span className="shrink-0 rounded-full bg-surface-input px-2 py-0.5 text-xs font-medium text-text-secondary">
          {quantidade} chamado{quantidade === 1 ? "" : "s"}
        </span>
      </button>

      {aberta && <ul className="flex flex-col gap-2 px-3 pb-3">{children}</ul>}
    </li>
  );
}
