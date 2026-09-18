"use client";

import { useState, type ReactNode } from "react";
import { useEhIOS } from "@/lib/ui/plataforma";
import { FOCUS_RING } from "@/lib/ui/styles";
import { PlacaRt } from "@/lib/ui/placa-rt";

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
  paraRevisaoQuantidade = 0,
  urlNavegacao,
  urlNavegacaoApple = null,
  children,
}: {
  codigo: string;
  endereco: string;
  quantidade: number;
  /** Quantos dos `quantidade` chamados nasceram "revisão técnica" (migration
   * 0046). Precisa aparecer no resumo mesmo com o grupo FECHADO — achado
   * real (14/09/2026): sem isso, a distinção "do dia" vs "para revisão"
   * ficava invisível atrás do clique de expandir, e foi reportado como bug
   * ("não está aparecendo a lista com chamados"), quando na verdade os dados
   * estavam corretos — só escondidos. */
  paraRevisaoQuantidade?: number;
  /** Link pro app de mapa do técnico. Ausente quando a RT não tem coordenada. */
  urlNavegacao?: string | null;
  /** Apple Maps (só aparece no iPhone/iPad — nunca cai na App Store). */
  urlNavegacaoApple?: string | null;
  children: ReactNode;
}) {
  const ios = useEhIOS();
  const [aberta, setAberta] = useState(false);

  return (
    <li className="rounded-[var(--radius-md)] bg-surface shadow-lift">
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
            <PlacaRt codigo={codigo} />
            <span className="mt-1 block truncate text-xs text-text-secondary">{endereco}</span>
          </span>
          {paraRevisaoQuantidade > 0 && paraRevisaoQuantidade < quantidade ? (
            <span className="flex shrink-0 items-center gap-1">
              <span className="inline-flex h-[22px] items-center rounded-full px-2 text-xs font-medium bg-sla-dentro-tint text-sla-dentro">
                {quantidade - paraRevisaoQuantidade} hoje
              </span>
              <span className="inline-flex h-[22px] items-center rounded-full px-2 text-xs font-medium bg-sla-proximo-tint text-sla-proximo">
                {paraRevisaoQuantidade} revisão
              </span>
            </span>
          ) : paraRevisaoQuantidade > 0 && paraRevisaoQuantidade === quantidade ? (
            <span className="shrink-0 inline-flex h-[22px] items-center rounded-full px-2 text-xs font-medium bg-sla-proximo-tint text-sla-proximo">
              {quantidade} para revisão
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-surface-input px-2 py-0.5 text-xs font-medium text-text-secondary">
              {quantidade} chamado{quantidade === 1 ? "" : "s"}
            </span>
          )}
        </button>

        {urlNavegacao && (
          <a
            href={urlNavegacao}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Navegar até ${codigo} no Google Maps`}
            className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] border border-border px-3 text-[10px] font-medium text-accent transition-colors hover:bg-surface-input ${FOCUS_RING}`}
          >
            <span aria-hidden="true" className="text-base leading-none">
              ➤
            </span>
            Ir
          </a>
        )}
        {ios && urlNavegacaoApple && (
          <a
            href={urlNavegacaoApple}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Navegar até ${codigo} no Apple Maps`}
            className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)] border border-border px-2.5 text-[10px] font-medium text-text-secondary transition-colors hover:bg-surface-input ${FOCUS_RING}`}
          >
            <span aria-hidden="true" className="text-base leading-none">
              ➤
            </span>
            Apple
          </a>
        )}
      </div>

      {aberta && <ul className="flex flex-col gap-2 px-3 pb-3">{children}</ul>}
    </li>
  );
}
