"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { RtGrupo } from "./rt-grupo";
import { StatusServicoBadge, type StatusServico } from "../status-servico-badge";
import { MapaDoDia } from "./mapa-do-dia";
import { BotaoRotaOtimizada } from "./botao-rota-otimizada";
import { BotaoAtualizarLocalizacao } from "./botao-atualizar-localizacao";
import { LinhaDeRota, type Parada } from "@/lib/ui/linha-de-rota";
import {
  linkAppleMapsDestino,
  linkGoogleMapsDestino,
  linkGoogleMapsRota,
  paradasNavegaveis,
  type EnderecoNavegacao,
} from "@/lib/navegacao";

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
  rtLogradouro: string | null;
  rtNumero: string | null;
  rtBairro: string | null;
  rtCidade: string | null;
  rtUf: string | null;
  rtCep: string | null;
  assunto: string;
  protocolo: string | null;
  criadoEm: string;
  prioridade: Prioridade;
  slaPrazo: string | null;
  chamadoStatus: "aberto" | "em_andamento" | "finalizado" | "cancelado";
};

const FECHADO = new Set<StatusServico>(["concluido_tecnico", "aguardando_validacao", "validado", "cancelado"]);

// Paradas da linha de rota do dia: uma por RT (na ordem da rota). RT
// "fechada" = nenhum serviço dela ainda em aberto; a parada atual é a
// primeira ainda aberta.
function paradasDaLinha(rts: [string, ServicoItem[]][]): Parada[] {
  let atualMarcada = false;
  return rts.map(([codigo, doRt], i) => {
    const fechada = doRt.every((s) => FECHADO.has(s.status));
    const emAndamento = doRt.some((s) => s.status === "em_execucao" || s.status === "em_revisao");
    const atual = !fechada && !atualMarcada;
    if (atual) atualMarcada = true;
    return {
      rotulo: codigo,
      valor: fechada ? "✓" : i + 1,
      tom: fechada ? "sucesso" : emAndamento || atual ? "accent" : "info",
      cheio: fechada,
      atual,
      descricao: `${codigo}: ${fechada ? "concluída" : emAndamento ? "em andamento" : atual ? "próxima parada" : "a fazer"}`,
    };
  });
}

// Endereço estruturado da RT no formato que lib/navegacao.ts consome — é o
// que entra no link do Google Maps/Waze. A coordenada vai junto só como
// fallback pra RT que ainda não tenha logradouro cadastrado.
function enderecoDaRt(s: ServicoItem | undefined): EnderecoNavegacao {
  return {
    logradouro: s?.rtLogradouro ?? null,
    numero: s?.rtNumero ?? null,
    bairro: s?.rtBairro ?? null,
    cidade: s?.rtCidade ?? null,
    uf: s?.rtUf ?? null,
    cep: s?.rtCep ?? null,
    enderecoLivre: s?.rtEndereco ?? null,
    lat: s?.rtLat ?? null,
    lng: s?.rtLng ?? null,
  };
}

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
      // Carrega o endereço inteiro: é ele que vai no link de navegação.
      const paradas = paradasNavegaveis(rts.map(([, doRt]) => enderecoDaRt(doRt[0])));
      const paradasComCodigo = rts
        .map(([codigo, doRt]) => {
          const endereco = enderecoDaRt(doRt[0]);
          return { codigo, lat: endereco.lat, lng: endereco.lng, endereco };
        })
        .filter(
          (x): x is { codigo: string; lat: number; lng: number; endereco: EnderecoNavegacao } =>
            x.lat != null && x.lng != null,
        );
      return { dia, rts, navegacao: linkGoogleMapsRota(paradas), paradasComCodigo };
    });
  }, [filtrados]);

  return (
    <div className="flex-1 px-4 py-4">
      {servicos.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="sr-only" htmlFor="busca-servicos">
              Buscar serviços
            </label>
            <input
              id="busca-servicos"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por RT, endereço, assunto ou protocolo..."
              className="w-full rounded-[var(--radius-md)] bg-surface shadow-lift px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <BotaoAtualizarLocalizacao />
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
                  <span className="ml-2 inline-flex h-5 items-center rounded-full bg-accent px-2 text-[11px] font-semibold text-on-accent">
                    hoje
                  </span>
                )}
              </h2>

              {/* Onde estou na rota: uma parada por RT, na ordem, ✓ nas que
                  já não têm nada em aberto; a atual é a primeira ainda
                  aberta. Só até 8 paradas — acima disso os rótulos não
                  cabem no celular e a lista abaixo já conta a história. */}
              {rts.length > 1 && rts.length <= 8 && (
                <div className="mb-4 rounded-[var(--radius-md)] bg-surface px-3 pt-4 pb-3 shadow-lift">
                  <LinhaDeRota
                    tamanho="compacto"
                    ariaLabel={`Paradas da rota de ${formatoDataCurta.format(new Date(`${dia}T00:00:00`))}`}
                    paradas={paradasDaLinha(rts)}
                  />
                </div>
              )}
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
                      urlNavegacao={doRt[0] ? linkGoogleMapsDestino(enderecoDaRt(doRt[0])) : null}
                      urlNavegacaoApple={doRt[0] ? linkAppleMapsDestino(enderecoDaRt(doRt[0])) : null}
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
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-on-accent">
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
                                    <span className="inline-flex h-[22px] items-center rounded-full px-2 text-xs font-medium bg-priority-alta-tint text-priority-alta">
                                      Retorno
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
                                    <span className="inline-flex h-[22px] items-center rounded-full px-2 text-xs font-medium bg-sla-dentro-tint text-sla-dentro">
                                      Hoje
                                    </span>
                                  ) : (
                                    <span className="inline-flex h-[22px] items-center rounded-full px-2 text-xs font-medium bg-sla-proximo-tint text-sla-proximo">
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
