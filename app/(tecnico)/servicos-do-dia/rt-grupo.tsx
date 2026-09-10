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
// Começa ABERTO: a lista de hoje é o trabalho do dia, e obrigar um clique pra
// ver o que fazer seria pior. Fechar serve pra tirar do caminho a RT já
// resolvida.
export function RtGrupo({
  codigo,
  endereco,
  quantidade,
  urlNavegacao,
  children,
}: {
  codigo: string;
  endereco: string;
  quantidade: number;
  /** Link pro app de mapa do técnico. Ausente quando a RT não tem coordenada. */
  urlNavegacao?: string | null;
  children: ReactNode;
}) {
  const [aberta, setAberta] = useState(true);

  return (
    <li className="rounded-[var(--radius-md)] border border-border bg-surface">
      {/* O gatilho e o link de navegação são IRMÃOS, não aninhados: um <a>
          dentro de um <button> é HTML inválido e o clique fica ambíguo. */}
      <div className="flex items-stretch gap-1 p-2">
        <button
          type="button"
          onClick={() => setAberta((v) => !v)}
          aria-expanded={aberta}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-sm)] p-2 text-left transition-colors hover:bg-surface-input ${FOCUS_RING}`}
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

        {urlNavegacao && (
          <a
            href={urlNavegacao}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Navegar até ${codigo} no app de mapa`}
            className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] border border-border px-3 text-[10px] font-medium text-accent transition-colors hover:bg-surface-input ${FOCUS_RING}`}
          >
            <span aria-hidden="true" className="text-base leading-none">
              ➤
            </span>
            Ir
          </a>
        )}
      </div>

      {aberta && <ul className="flex flex-col gap-2 px-3 pb-3">{children}</ul>}
    </li>
  );
}
