"use client";

import { useMemo, useState } from "react";
import { ChamadoCreateDialog } from "./chamado-create-dialog";
import { ChamadoDetalheDialog } from "./chamado-detalhe-dialog";
import { PrioridadeBadge, type Prioridade } from "./prioridade-badge";
import { SlaBadge } from "./sla-badge";
import { StatusChamadoBadge, type StatusChamado } from "./status-chamado-badge";
import { FOCUS_RING, TAP_TARGET } from "@/lib/ui/styles";
import { computeSlaStatus, type SlaStatus } from "@/lib/sla";
import { buscarDetalheChamado, marcarRespostasVistas, type DetalheChamado } from "./actions";

const DETALHE_VAZIO: DetalheChamado = { descricao: null, historico: [], respostas: [], anexosCliente: [] };

type Rt = { id: string; codigo: string; endereco: string; regiaoNome: string; zonaNome: string };

export type ChamadoRow = {
  id: string;
  tomticketId: string | null;
  rtId: string;
  rtCodigo: string;
  rtNome: string;
  regiaoNome: string;
  zonaNome: string;
  assunto: string;
  prioridade: Prioridade;
  status: StatusChamado;
  slaPrazo: string | null;
  criadoEm: string;
  temRespostaNova: boolean;
};

const SLA_OPTIONS: { value: SlaStatus; label: string }[] = [
  { value: "vencido", label: "SLA vencido" },
  { value: "proximo", label: "Próximo do vencimento" },
  { value: "dentro", label: "Dentro do prazo" },
];

type ModoDialogo = "nenhum" | "criar" | "detalhes";

const formatoData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// 50 por página: o suficiente pra rolar sem paginar toda hora, e pequeno o
// bastante pra manter o HTML leve.
const POR_PAGINA = 50;

export function ChamadosManager({
  chamados,
  rts,
  podeCriar,
  podeResponder,
  chamadoIdInicial = null,
  detalheInicial = null,
}: {
  chamados: ChamadoRow[];
  rts: Rt[];
  podeCriar: boolean;
  podeResponder: boolean;
  /** Veio do toast (?chamado=<id>): abre esse chamado já no primeiro render. */
  chamadoIdInicial?: string | null;
  /** Detalhe já buscado no server pro chamado do deep-link. */
  detalheInicial?: DetalheChamado | null;
}) {
  // Linha do deep-link (const, não state: o componente remonta por `key` quando
  // o ?chamado= muda, então isto é recalculado a cada montagem).
  const chamadoDoDeepLink = chamadoIdInicial
    ? (chamados.find((c) => c.id === chamadoIdInicial) ?? null)
    : null;

  const [busca, setBusca] = useState("");
  const [prioridadeFiltro, setPrioridadeFiltro] = useState("todas");
  const [regiaoFiltro, setRegiaoFiltro] = useState("todas");
  const [slaFiltro, setSlaFiltro] = useState("todos");
  // Chamado encerrado (finalizado OU cancelado — inclui o excluído no TomTicket,
  // migration 0044) some da lista por padrão (pedido do usuário, 10/09/2026) — a
  // tela é o espelho/busca do TomTicket, não a fila de trabalho; o toggle traz
  // de volta pra consulta de histórico.
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const [soRespostaNova, setSoRespostaNova] = useState(false);
  const totalRespostaNova = useMemo(() => chamados.filter((c) => c.temRespostaNova).length, [chamados]);
  const [modoDialogo, setModoDialogo] = useState<ModoDialogo>(chamadoDoDeepLink ? "detalhes" : "nenhum");
  const [chamadoSelecionado, setChamadoSelecionado] = useState<ChamadoRow | null>(chamadoDoDeepLink);
  // ver comentário equivalente em rts-manager.tsx: força os diálogos a
  // remontar do zero a cada abertura.
  const [dialogInstancia, setDialogInstancia] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [detalhe, setDetalhe] = useState<DetalheChamado | null>(
    chamadoDoDeepLink ? (detalheInicial ?? DETALHE_VAZIO) : null,
  );

  // Regiões agrupadas por zona (mesma fonte que o seletor de RT dos
  // diálogos) — todas as 98 RTs entram aqui, então o filtro sempre lista
  // todas as regiões existentes, mesmo as sem chamado em aberto agora.
  const regioesPorZona = useMemo(() => {
    const porZona = new Map<string, Set<string>>();
    for (const rt of rts) {
      const zona = porZona.get(rt.zonaNome) ?? new Set<string>();
      zona.add(rt.regiaoNome);
      porZona.set(rt.zonaNome, zona);
    }
    return [...porZona.entries()].map(([zona, regioes]) => ({
      zona,
      regioes: [...regioes].sort(),
    }));
  }, [rts]);

  const linhasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return chamados.filter((c) => {
      if (!mostrarEncerrados && (c.status === "finalizado" || c.status === "cancelado")) return false;
      if (soRespostaNova && !c.temRespostaNova) return false;
      if (prioridadeFiltro !== "todas" && c.prioridade !== prioridadeFiltro) return false;
      if (regiaoFiltro !== "todas" && c.regiaoNome !== regiaoFiltro) return false;
      if (slaFiltro !== "todos") {
        // chamado encerrado mostra "—" no badge de SLA (ver sla-badge.tsx)
        // — não faz sentido ele aparecer num filtro de estado de SLA ativo.
        if (c.status === "finalizado" || c.status === "cancelado") return false;
        if (computeSlaStatus(c.slaPrazo) !== slaFiltro) return false;
      }
      if (!termo) return true;
      return (
        c.assunto.toLowerCase().includes(termo) ||
        c.rtCodigo.toLowerCase().includes(termo) ||
        c.rtNome.toLowerCase().includes(termo) ||
        (c.tomticketId ?? "").toLowerCase().includes(termo)
      );
    });
  }, [chamados, busca, prioridadeFiltro, regiaoFiltro, slaFiltro, mostrarEncerrados, soRespostaNova]);

  // Renderizar a lista inteira de uma vez era o gargalo real da tela: com
  // ~300 chamados o HTML passava de 750kb, e cada linha ainda é serializada
  // de novo no payload de hidratação. Os dados continuam TODOS em memória
  // (a busca e os filtros seguem instantâneos, sem ida ao servidor) — só a
  // renderização é paginada.
  const totalPaginas = Math.max(1, Math.ceil(linhasFiltradas.length / POR_PAGINA));
  // Filtrar pode encolher a lista abaixo da página atual; sem isto a tela
  // ficaria vazia sem explicação.
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * POR_PAGINA;
  const linhasVisiveis = linhasFiltradas.slice(inicio, inicio + POR_PAGINA);

  function abrir(modo: ModoDialogo, chamado: ChamadoRow | null = null) {
    setChamadoSelecionado(chamado);
    setModoDialogo(modo);
    setDialogInstancia((n) => n + 1);

    // Mensagem e histórico não vêm na lista (inflavam o HTML de toda a tela
    // pra serem lidos num chamado só). Busca aqui, no clique — evento, não
    // efeito, então não esbarra na regra react-hooks/set-state-in-effect.
    if (modo === "detalhes" && chamado) {
      setDetalhe(null);
      buscarDetalheChamado(chamado.id)
        .then(setDetalhe)
        .catch(() => setDetalhe(DETALHE_VAZIO));
      // Abrir o chamado = "li as respostas do cliente" — some do sino.
      if (chamado.temRespostaNova) void marcarRespostasVistas(chamado.id);
    }
  }

  function fechar() {
    setModoDialogo("nenhum");
    // Se a tela abriu por deep-link (?chamado=<id>), tira o parâmetro da URL pra
    // um F5 não reabrir o modal. `history.replaceState` (não router.replace):
    // só limpa a query, sem round-trip nem remontar a lista/perder filtros.
    if (chamadoIdInicial && typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", "/chamados");
    }
  }

  function recarregarDetalhe(chamadoId: string) {
    // Após responder no TomTicket: atualiza a linha do tempo sem piscar
    // "Carregando..." no modal inteiro.
    buscarDetalheChamado(chamadoId)
      .then(setDetalhe)
      .catch(() => {});
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="busca-chamados">
          Buscar chamados
        </label>
        <input
          id="busca-chamados"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por assunto, RT ou protocolo..."
          className="min-w-64 flex-1 rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />

        <label className="sr-only" htmlFor="filtro-prioridade">
          Filtrar por prioridade
        </label>
        <select
          id="filtro-prioridade"
          value={prioridadeFiltro}
          onChange={(e) => setPrioridadeFiltro(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="todas">Todas as prioridades</option>
          <option value="emergencial">Emergencial</option>
          <option value="alta">Alta</option>
          <option value="normal">Normal</option>
          <option value="baixa">Baixa</option>
        </select>

        <label className="sr-only" htmlFor="filtro-regiao">
          Filtrar por região
        </label>
        <select
          id="filtro-regiao"
          value={regiaoFiltro}
          onChange={(e) => setRegiaoFiltro(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="todas">Todas as regiões</option>
          {regioesPorZona.map(({ zona, regioes }) => (
            <optgroup key={zona} label={zona}>
              {regioes.map((regiao) => (
                <option key={regiao} value={regiao}>
                  {regiao}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <label className="sr-only" htmlFor="filtro-sla">
          Filtrar por status de SLA
        </label>
        <select
          id="filtro-sla"
          value={slaFiltro}
          onChange={(e) => setSlaFiltro(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="todos">Todos os status de SLA</option>
          {SLA_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={mostrarEncerrados}
            onChange={(e) => setMostrarEncerrados(e.target.checked)}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
          />
          Mostrar encerrados
        </label>

        {totalRespostaNova > 0 && (
          <button
            type="button"
            onClick={() => setSoRespostaNova((v) => !v)}
            aria-pressed={soRespostaNova}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${FOCUS_RING} ${
              soRespostaNova
                ? "border-accent bg-accent text-white"
                : "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
            }`}
          >
            🔔 {totalRespostaNova} com resposta nova
          </button>
        )}

        <div className="ml-auto flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => abrir("criar")}
            disabled={!podeCriar}
            title={
              podeCriar
                ? undefined
                : "Em avaliação pela gestão — por enquanto, chamados criados manualmente entram pela tela da gestão."
            }
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-text-muted disabled:hover:bg-text-muted ${FOCUS_RING}`}
          >
            + Novo chamado
          </button>
          {!podeCriar && (
            <p className="text-xs text-text-tertiary">Em avaliação pela gestão</p>
          )}
        </div>
      </div>

      <p className="mb-2 text-xs text-text-tertiary" role="status">
        {linhasFiltradas.length === 0
          ? "Nenhum chamado com esses filtros"
          : `Mostrando ${inicio + 1}–${inicio + linhasVisiveis.length} de ${linhasFiltradas.length}`}
        {linhasFiltradas.length !== chamados.length && ` (${chamados.length} no total)`}
      </p>

      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-text-tertiary">
              <th scope="col" className="px-4 py-2.5 font-medium">RT</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Assunto</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Prioridade</th>
              <th scope="col" className="px-4 py-2.5 font-medium">SLA</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Criado em</th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {linhasVisiveis.map((c) => (
              <tr
                key={c.id}
                onClick={() => abrir("detalhes", c)}
                className="cursor-pointer transition-colors hover:bg-surface-input"
              >
                <td className="px-4 py-2.5 align-top">
                  <p className="font-mono text-xs tabular-nums text-text-secondary">
                    {c.rtCodigo}
                  </p>
                  <p className="mt-0.5 text-xs text-text-tertiary">{c.rtNome}</p>
                </td>
                <td className="px-4 py-2.5 align-top">
                  <p className="text-text-primary">
                    {c.temRespostaNova && (
                      <span
                        className="mr-1.5 align-middle text-accent"
                        title="Resposta nova do cliente no TomTicket"
                        aria-label="Resposta nova do cliente"
                      >
                        🔔
                      </span>
                    )}
                    {c.assunto}
                  </p>
                  {c.tomticketId && (
                    <p className="mt-0.5 font-mono text-xs text-text-tertiary">
                      #{c.tomticketId}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5 align-top">
                  <PrioridadeBadge prioridade={c.prioridade} />
                </td>
                <td className="px-4 py-2.5 align-top">
                  <SlaBadge slaPrazo={c.slaPrazo} status={c.status} />
                </td>
                <td className="px-4 py-2.5 align-top">
                  <StatusChamadoBadge status={c.status} />
                </td>
                <td className="px-4 py-2.5 align-top whitespace-nowrap text-xs text-text-tertiary">
                  {formatoData.format(new Date(c.criadoEm))}
                </td>
                <td className="px-4 py-2.5 align-top">
                  <div className="flex items-center justify-end whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrir("detalhes", c);
                      }}
                      aria-label={`Ver detalhes do chamado ${c.assunto}`}
                      className={`text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING} ${TAP_TARGET}`}
                    >
                      Ver detalhes
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {linhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-tertiary">
                  Nenhum chamado encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <nav aria-label="Paginação dos chamados" className="mt-3 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPagina(paginaAtual - 1)}
            disabled={paginaAtual <= 1}
            className={`rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-primary ${FOCUS_RING}`}
          >
            ← Anterior
          </button>
          <span className="text-xs text-text-tertiary" aria-current="page">
            Página {paginaAtual} de {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => setPagina(paginaAtual + 1)}
            disabled={paginaAtual >= totalPaginas}
            className={`rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-primary ${FOCUS_RING}`}
          >
            Próxima →
          </button>
        </nav>
      )}

      <ChamadoCreateDialog
        key={`criar-${dialogInstancia}`}
        open={modoDialogo === "criar"}
        rts={rts}
        onClose={fechar}
      />
      <ChamadoDetalheDialog
        key={`detalhes-${dialogInstancia}`}
        open={modoDialogo === "detalhes"}
        chamado={chamadoSelecionado}
        detalhe={detalhe}
        podeResponder={podeResponder}
        onRespondido={() => {
          if (chamadoSelecionado) recarregarDetalhe(chamadoSelecionado.id);
        }}
        onClose={fechar}
      />
    </div>
  );
}
