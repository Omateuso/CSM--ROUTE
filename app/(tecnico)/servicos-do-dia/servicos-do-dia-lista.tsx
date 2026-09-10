"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { RtGrupo } from "./rt-grupo";
import { StatusServicoBadge, type StatusServico } from "../status-servico-badge";

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
  reexecucao: boolean;
  ordem: number;
  rotaData: string;
  rtCodigo: string;
  rtNome: string;
  rtEndereco: string;
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
      return { dia, rts: [...porRt.entries()] };
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
          {dias.map(({ dia, rts }) => (
            <section key={dia}>
              <h2 className="mb-2 text-sm font-semibold text-text-primary">
                Rota dia {formatoDataCurta.format(new Date(`${dia}T00:00:00`))}
                {dia === hoje && (
                  <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-white">
                    hoje
                  </span>
                )}
              </h2>
              <ul className="flex flex-col gap-3">
                {rts.map(([rtCodigo, doRt]) => (
                  <RtGrupo
                    key={rtCodigo}
                    codigo={rtCodigo}
                    endereco={doRt[0]?.rtEndereco ?? ""}
                    quantidade={doRt.length}
                  >
                    {doRt.map((s, indice) => (
                      <li key={s.id}>
                        <Link
                          href={`/servico/${s.id}`}
                          className="block rounded-[var(--radius-md)] border border-border bg-surface p-3 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white">
                              {indice + 1}
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
                          </div>
                        </Link>
                      </li>
                    ))}
                  </RtGrupo>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
