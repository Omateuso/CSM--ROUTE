"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { RtGrupo } from "./rt-grupo";
import { StatusServicoBadge, type StatusServico } from "../status-servico-badge";
import { MapaDoDia } from "./mapa-do-dia";
import { BotaoRotaOtimizada } from "./botao-rota-otimizada";
import { linkGoogleMapsDestino, linkGoogleMapsRota, paradasNavegaveis } from "@/lib/navegacao";

// Com ano: sem ele, um chamado de 2025 e um de 2026 aparecem como "08/09" e
// "12/11" e o técnico lê fora de ordem, sem ter como perceber.
const formatoDataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export type ServicoItem = {
  id: string;
  status: StatusServico;
  categoria: "concluir_hoje" | "revisao_tecnica";
  reexecucao: boolean;
  ordem: number;
  rotaData: string;
  rtCodigo: string;
  rtNome: string;
  rtEndereco: string;
  rtLat: number | null;
  rtLng: number | null;
  assunto: string;
  protocolo: string | null;
  criadoEm: string;
  prioridade: Prioridade;
  slaPrazo: string | null;
  chamadoStatus: "aberto" | "em_andamento" | "finalizado" | "cancelado";
};

// Barra de busca da tela do técnico (pedido do usuário, 10/09/2026) — filtra o
// array plano por código/nome/endereço da RT, assunto ou protocolo e reagrupa.
// A montagem visual (dia -> RT -> cards) vive aqui pra o filtro ser client-side,
// instantâneo, sem ida ao servidor; a page.tsx segue com toda a busca no banco.
export function ServicosDoDiaLista({ servicos, hoje }: { servicos: ServicoItem[]; hoje: string }) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return servicos;
    return servicos.filter(
      (s) =>
        (s.rtCodigo ?? "").toLowerCase().includes(termo) ||
        (s.rtNome ?? "").toLowerCase().includes(termo) ||
        (s.rtEndereco ?? "").toLowerCase().includes(termo) ||
        (s.assunto ?? "").toLowerCase().includes(termo) ||
        (s.protocolo ?? "").toLowerCase().includes(termo),
    );
  }, [servicos, busca]);

  // Agrupado por dia (ordem cronológica) e, dentro de cada dia, por RT — o
  // técnico visita CASAS, não chamados soltos.
  const dias = useMemo(() => {
    const porDia = new Map<string, ServicoItem[]>();
    for (const s of filtrados) {
      const lista = porDia.get(s.rotaData) ?? [];
      lista.push(s);
      porDia.set(s.rotaData, lista);
    }
    return [...porDia.entries()].map(([dia, doDia]) => {
      const porRt = new Map<string, ServicoItem[]>();
      for (const s of doDia) {
        const lista = porRt.get(s.rtCodigo) ?? [];
        lista.push(s);
        porRt.set(s.rtCodigo, lista);
      }
      const rts = [...porRt.entries()];
      // Uma parada por RT, na ordem da rota — e não um ponto por chamado.
      const paradas = paradasNavegaveis(
        rts.map(([, doRt]) => ({ lat: doRt[0]?.rtLat ?? null, lng: doRt[0]?.rtLng ?? null })),
      );
      const paradasComCodigo = rts
        .map(([codigo, doRt]) => ({ codigo, lat: doRt[0]?.rtLat ?? null, lng: doRt[0]?.rtLng ?? null }))
        .filter((x): x is { codigo: string; lat: number; lng: number } => x.lat != null && x.lng != null);
      return { dia, rts, navegacao: linkGoogleMapsRota(paradas), paradasComCodigo };
    });
  }, [filtrados]);

  return (
    <div className="flex-1 px-4 py-4">
      {servicos.length > 0 && (
        <div className="mb-4">
          <label className="sr-only" htmlFor="busca-servicos">
            Buscar serviços
          </label>
          <input
            id="busca-servicos"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por RT, endereço, assunto ou protocolo..."
            className="w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      {servicos.length === 0 ? (
        <p className="mt-8 text-center text-sm text-text-tertiary">Nenhum serviço planejado pra você.</p>
      ) : filtrados.length === 0 ? (
        <p className="mt-8 text-center text-sm text-text-tertiary">Nenhum serviço encontrado com essa busca.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {dias.map(({ dia, rts, navegacao, paradasComCodigo }) => (
            <section key={dia}>
              <h2 className="mb-2 text-sm font-semibold text-text-primary">
                Rota dia {formatoDataCurta.format(new Date(`${dia}T00:00:00`))}
                {dia === hoje && (
                  <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-white">
                    hoje
                  </span>
                )}
              </h2>

              {navegacao && <BotaoRotaOtimizada paradas={paradasComCodigo} linkPadrao={navegacao} />}
              <MapaDoDia paradas={paradasComCodigo} />

              {navegacao?.truncada && (
                <p className="mb-3 text-xs text-text-tertiary">
                  O Google Maps aceita no máximo 10 paradas por link — este abre as{" "}
                  {navegacao.paradasNoLink} primeiras da rota.
                </p>
              )}
              <ul className="flex flex-col gap-3">
                {rts.map(([rtCodigo, doRt]) => {
                  // Categoria escolhida pelo gerente ao confirmar a rota
                  // (migration 0046) — calculado aqui, fora do corpo fechado
                  // do RtGrupo, pra aparecer no resumo mesmo com o grupo
                  // FECHADO (pedido do usuário, 10/09/2026): sem isso, a
                  // distinção "do dia" vs "para revisão" ficava escondida
                  // atrás de um clique extra — o próprio motivo do bug
                  // relatado (14/09/2026).
                  const doDia = doRt.filter((s) => s.categoria === "concluir_hoje");
                  const paraRevisao = doRt.filter((s) => s.categoria === "revisao_tecnica");
                  const misto = doDia.length > 0 && paraRevisao.length > 0;

                  return (
                    <RtGrupo
                      key={rtCodigo}
                      codigo={rtCodigo}
                      endereco={doRt[0]?.rtEndereco ?? ""}
                      quantidade={doRt.length}
                      paraRevisaoQuantidade={paraRevisao.length}
                      urlNavegacao={
                        doRt[0]?.rtLat != null && doRt[0]?.rtLng != null
                          ? linkGoogleMapsDestino({ lat: doRt[0].rtLat, lng: doRt[0].rtLng })
                          : null
                      }
                    >
                      {(() => {
                        let numero = 0;

                        const cartao = (s: ServicoItem) => {
                          numero += 1;
                          return (
                            <li key={s.id}>
                              <Link
                                href={`/servico/${s.id}`}
                                className={`block rounded-[var(--radius-md)] border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                  s.categoria === "concluir_hoje"
                                    ? "border-sla-dentro/30 bg-sla-dentro/5 hover:border-sla-dentro/50"
                                    : "border-sla-proximo/30 bg-sla-proximo/5 hover:border-sla-proximo/50"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white">
                                    {numero}
                                  </span>
                                  {s.protocolo && (
                                    <span className="font-mono text-xs text-text-tertiary">#{s.protocolo}</span>
                                  )}
                                  {s.criadoEm && (
                                    <span className="text-xs text-text-tertiary">
                                      criado em {formatoDataCurta.format(new Date(s.criadoEm))}
                                    </span>
                                  )}
                                  {s.reexecucao && (
                                    <span className="rounded-full bg-priority-alta/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-priority-alta uppercase">
                                      ↩ Retorno
                                    </span>
                                  )}
                                  <span className="ml-auto">
                                    <StatusServicoBadge status={s.status} />
                                  </span>
                                </div>
                                <p className="mt-2 text-sm font-medium text-text-primary">{s.assunto}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                  <PrioridadeBadge prioridade={s.prioridade} />
                                  <SlaBadge slaPrazo={s.slaPrazo} status={s.chamadoStatus} />
                                  {s.categoria === "concluir_hoje" ? (
                                    <span className="rounded-full bg-sla-dentro/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sla-dentro uppercase">
                                      Hoje
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-sla-proximo/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sla-proximo uppercase">
                                      Para revisão
                                    </span>
                                  )}
                                </div>
                              </Link>
                            </li>
                          );
                        };

                        return (
                          <>
                            {misto && doDia.length > 0 && (
                              <li className="px-1 text-[11px] font-semibold tracking-wide text-sla-dentro uppercase">
                                Chamados do dia
                              </li>
                            )}
                            {doDia.map(cartao)}
                            {misto && paraRevisao.length > 0 && (
                              <li className="px-1 pt-1 text-[11px] font-semibold tracking-wide text-sla-proximo uppercase">
                                Chamados para revisão
                              </li>
                            )}
                            {paraRevisao.map(cartao)}
                          </>
                        );
                      })()}
                    </RtGrupo>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
