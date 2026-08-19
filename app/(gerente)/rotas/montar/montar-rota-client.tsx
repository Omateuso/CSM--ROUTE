"use client";

import { useCallback, useMemo, useState } from "react";
import { MontarRotaMapa } from "./montar-rota-mapa";
import { ConfirmarRotaDialog } from "./confirmar-rota-dialog";
import { FOCUS_RING, TAP_TARGET } from "@/lib/ui/styles";
import type { Candidata } from "@/lib/routing/intelligent-route";
import type { Nucleo } from "@/lib/routing/clusters";

type Equipe = { id: string; nome: string };
type Tecnico = { id: string; nome: string; equipeId: string | null; ativo: boolean };

// Só os campos que a UI/mapa precisam pra exibir — a agregação de
// chamados (volume/prioridade/SLA) fica só no server, que já manda os
// números prontos dentro de cada `Candidata`.
export type RtParaRota = {
  id: string;
  codigo: string;
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
  regiaoId: string;
};

type Regiao = { id: string; nome: string; zonaNome: string };

const ROTULO_INFO: Record<Candidata["rotulo"], { label: string; corTexto: string; corDot: string }> = {
  recomendada: { label: "⭐ Recomendada", corTexto: "font-semibold text-sla-dentro", corDot: "bg-sla-dentro" },
  boa_opcao: { label: "Boa opção", corTexto: "text-text-secondary", corDot: "bg-priority-alta" },
  alto_deslocamento: {
    label: "Alto deslocamento",
    corTexto: "text-text-tertiary",
    corDot: "border border-text-tertiary",
  },
};

export function MontarRotaClient({
  regioes,
  rts,
  equipes,
  tecnicos,
  candidatasIniciais,
  nucleoInicial,
}: {
  regioes: Regiao[];
  rts: RtParaRota[];
  equipes: Equipe[];
  tecnicos: Tecnico[];
  candidatasIniciais: Candidata[];
  nucleoInicial: Nucleo | null;
}) {
  const [regiaoId, setRegiaoId] = useState("");
  const [rotaIds, setRotaIds] = useState<string[]>([]);
  const [candidatas, setCandidatas] = useState<Candidata[]>(candidatasIniciais);
  const [nucleo, setNucleo] = useState<Nucleo | null>(nucleoInicial);
  const [nucleoDispensado, setNucleoDispensado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmarAberto, setConfirmarAberto] = useState(false);
  const [confirmarInstancia, setConfirmarInstancia] = useState(0);
  const [rotaConfirmada, setRotaConfirmada] = useState(false);
  const [buscaCandidata, setBuscaCandidata] = useState("");

  const rtsPorId = useMemo(() => new Map(rts.map((r) => [r.id, r])), [rts]);
  const zonas = useMemo(() => [...new Set(regioes.map((r) => r.zonaNome))], [regioes]);

  // Várias RTs (ex.: casas do mesmo condomínio) caem exatamente na mesma
  // coordenada e ficam empilhadas no mapa, indistinguíveis visualmente —
  // a busca por texto é o jeito de achar a certa mesmo quando o mapa não
  // consegue mostrar todas separadas.
  const candidatasFiltradas = useMemo(() => {
    const termo = buscaCandidata.trim().toLowerCase();
    if (!termo) return candidatas;
    return candidatas.filter(
      (c) => c.codigo.toLowerCase().includes(termo) || c.endereco.toLowerCase().includes(termo),
    );
  }, [candidatas, buscaCandidata]);

  const buscarSugestao = useCallback(
    async (referenciaRtId: string | null, regiao: string, jaSelecionadas: string[]) => {
      setCarregando(true);
      setErro(null);
      try {
        const resposta = await fetch("/api/rotas/sugestao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referenciaRtId, regiaoId: regiao || null, jaSelecionadas }),
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error ?? "Erro ao buscar sugestão de rota.");
        setCandidatas(dados.candidatas ?? []);
        setNucleo(dados.nucleo ?? null);
        setNucleoDispensado(false);
        setBuscaCandidata("");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao buscar sugestão de rota.");
      } finally {
        setCarregando(false);
      }
    },
    [],
  );

  // troca de região só importa antes da 1ª RT escolhida (item 6 do spec —
  // depois disso quem manda é a proximidade da última RT, não a região).
  // Disparado pelo evento de troca em si, não por um efeito reagindo ao
  // estado — não tem "buscar de novo sozinho" escondido.
  function handleTrocarRegiao(novaRegiaoId: string) {
    setRegiaoId(novaRegiaoId);
    if (rotaIds.length === 0) buscarSugestao(null, novaRegiaoId, []);
  }

  function adicionarRt(rtId: string) {
    const novaRota = [...rotaIds, rtId];
    setRotaIds(novaRota);
    buscarSugestao(rtId, regiaoId, novaRota);
  }

  function removerRt(rtId: string) {
    const novaRota = rotaIds.filter((id) => id !== rtId);
    setRotaIds(novaRota);
    buscarSugestao(novaRota[novaRota.length - 1] ?? null, regiaoId, novaRota);
  }

  function moverRt(indice: number, direcao: -1 | 1) {
    const novoIndice = indice + direcao;
    if (novoIndice < 0 || novoIndice >= rotaIds.length) return;
    const nova = [...rotaIds];
    [nova[indice], nova[novoIndice]] = [nova[novoIndice], nova[indice]];
    setRotaIds(nova);
    // só troca a ordem visual — a referência de proximidade continua
    // sendo a última RT da lista, que não mudou.
  }

  function limparRota() {
    setRotaIds([]);
    buscarSugestao(null, regiaoId, []);
  }

  function aceitarForcaTarefa() {
    if (!nucleo) return;
    const novosIds = nucleo.rtIds.filter((id) => !rotaIds.includes(id));
    const novaRota = [...rotaIds, ...novosIds];
    setRotaIds(novaRota);
    buscarSugestao(novaRota[novaRota.length - 1] ?? null, regiaoId, novaRota);
  }

  return (
    <div className="flex flex-col gap-6">
      {rotaConfirmada && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-sla-dentro/30 bg-sla-dentro/5 px-4 py-3"
        >
          <p className="text-sm text-text-primary">
            ✓ Rota confirmada — os técnicos da equipe vão ver os serviços dela a partir da Fase 3.
          </p>
          <button
            type="button"
            onClick={() => setRotaConfirmada(false)}
            aria-label="Fechar aviso"
            className={`shrink-0 text-text-tertiary hover:text-text-primary ${FOCUS_RING}`}
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="filtro-regiao-rota">
          Região
        </label>
        <select
          id="filtro-regiao-rota"
          value={regiaoId}
          onChange={(e) => handleTrocarRegiao(e.target.value)}
          disabled={rotaIds.length > 0}
          className="rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">Todas as regiões</option>
          {zonas.map((zonaNome) => (
            <optgroup key={zonaNome} label={zonaNome}>
              {regioes
                .filter((r) => r.zonaNome === zonaNome)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <p className="text-xs text-text-tertiary">
          {rotaIds.length === 0
            ? "Filtra a primeira escolha. Depois disso, a proximidade da última RT decide — a região não bloqueia mais."
            : "A região não filtra mais candidatas — a partir da 1ª RT, quem decide é a proximidade real."}
        </p>

        {rotaIds.length > 0 && (
          <button
            type="button"
            onClick={limparRota}
            className={`ml-auto text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING} ${TAP_TARGET}`}
          >
            Desmarcar tudo
          </button>
        )}
      </div>

      <div className="h-[420px]">
        <MontarRotaMapa rts={rts} rotaIds={rotaIds} candidatas={candidatasFiltradas} onSelecionar={adicionarRt} />
      </div>

      {nucleo && !nucleoDispensado && (
        <div className="rounded-[var(--radius-md)] border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-semibold text-text-primary">⚡ Força-tarefa recomendada</p>
          <p className="mt-1 text-sm text-text-secondary">
            Foram identificadas {nucleo.rtIds.length} RTs muito próximas entre si, totalizando{" "}
            {nucleo.totalChamados} chamados em aberto. A concentração geográfica permite atender
            várias com baixo deslocamento entre elas.
          </p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={aceitarForcaTarefa}
              className={`rounded-[var(--radius-sm)] bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover ${FOCUS_RING}`}
            >
              Aceitar força-tarefa
            </button>
            <button
              type="button"
              onClick={() => setNucleoDispensado(true)}
              className={`rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary ${FOCUS_RING}`}
            >
              Continuar rota normal
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="sr-only" htmlFor="busca-candidata-rota">
          Buscar RT por código ou endereço
        </label>
        <input
          id="busca-candidata-rota"
          type="search"
          value={buscaCandidata}
          onChange={(e) => setBuscaCandidata(e.target.value)}
          placeholder="Buscar por código ou endereço — útil quando várias RTs caem no mesmo ponto do mapa..."
          className="w-full rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-text-primary">
            Rota em construção {rotaIds.length > 0 && `(${rotaIds.length})`}
          </h2>
          {rotaIds.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-border-strong bg-surface-input p-4 text-xs text-text-tertiary">
              Escolha a primeira RT na lista ao lado ou clique numa RT no mapa.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {rotaIds.map((id, indice) => {
                const rt = rtsPorId.get(id);
                if (!rt) return null;
                return (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-surface p-2.5"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white">
                      {indice + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-text-primary">{rt.codigo}</p>
                      <p className="truncate text-xs text-text-tertiary">{rt.endereco}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moverRt(indice, -1)}
                        disabled={indice === 0}
                        aria-label={`Mover ${rt.codigo} pra cima`}
                        className={`text-text-tertiary hover:text-text-primary disabled:opacity-30 ${FOCUS_RING}`}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moverRt(indice, 1)}
                        disabled={indice === rotaIds.length - 1}
                        aria-label={`Mover ${rt.codigo} pra baixo`}
                        className={`text-text-tertiary hover:text-text-primary disabled:opacity-30 ${FOCUS_RING}`}
                      >
                        ▼
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerRt(id)}
                      aria-label={`Remover ${rt.codigo} da rota`}
                      className={`shrink-0 text-text-tertiary hover:text-danger ${FOCUS_RING} ${TAP_TARGET}`}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          {rotaIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setConfirmarInstancia((n) => n + 1);
                setConfirmarAberto(true);
              }}
              className={`mt-3 w-full rounded-[var(--radius-sm)] bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover ${FOCUS_RING}`}
            >
              Confirmar rota do dia
            </button>
          )}
        </section>

        <section>
          <h2 className="mb-1 text-sm font-semibold text-text-primary">
            {rotaIds.length === 0 ? "RTs disponíveis" : "Próximas melhores opções"}
          </h2>
          <p className="mb-3 text-xs text-text-tertiary">
            {rotaIds.length === 0
              ? "Ordenadas por relevância operacional (volume, prioridade, SLA)."
              : `A partir de ${rtsPorId.get(rotaIds[rotaIds.length - 1])?.codigo ?? "—"}, a última RT escolhida.`}
          </p>

          {erro && (
            <p role="alert" className="mb-3 text-sm text-danger">
              {erro}
            </p>
          )}

          {carregando ? (
            <p className="text-sm text-text-tertiary">Calculando sugestões...</p>
          ) : candidatasFiltradas.length === 0 ? (
            <p className="text-sm text-text-tertiary">
              {candidatas.length === 0
                ? "Nenhuma candidata disponível."
                : "Nenhuma candidata encontrada com essa busca."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {candidatasFiltradas.map((c) => {
                const info = ROTULO_INFO[c.rotulo];
                return (
                  <li
                    key={c.rtId}
                    className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text-secondary">{c.codigo}</span>
                        <span className={`inline-flex items-center gap-1 text-xs ${info.corTexto}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${info.corDot}`} aria-hidden="true" />
                          {info.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-text-primary">{c.endereco}</p>
                      <p className="mt-1 text-xs text-text-tertiary">{c.motivo}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => adicionarRt(c.rtId)}
                      aria-label={`Adicionar ${c.codigo} à rota`}
                      className={`shrink-0 rounded-[var(--radius-sm)] bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover ${FOCUS_RING}`}
                    >
                      + Adicionar
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <ConfirmarRotaDialog
        key={confirmarInstancia}
        open={confirmarAberto}
        rtsNaRota={rotaIds.map((id) => rtsPorId.get(id)).filter((rt): rt is RtParaRota => Boolean(rt))}
        equipes={equipes}
        tecnicos={tecnicos}
        onClose={() => setConfirmarAberto(false)}
        onConfirmado={() => {
          setRotaConfirmada(true);
          setRotaIds([]);
          buscarSugestao(null, regiaoId, []);
        }}
      />
    </div>
  );
}
