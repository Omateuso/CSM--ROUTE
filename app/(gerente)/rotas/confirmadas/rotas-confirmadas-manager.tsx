"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/lib/ui/modal";
import { CorrigirDataDialog } from "./corrigir-data-dialog";
import { CancelarRotaDialog } from "./cancelar-rota-dialog";
import { EditarParadasDialog, type RtOpcao, type TecnicoOpcao } from "./editar-paradas-dialog";
import { FOCUS_RING, TAP_TARGET } from "@/lib/ui/styles";
import { StatusDot } from "@/lib/ui/status-dot";
import { PlacaRt } from "@/lib/ui/placa-rt";

type Regiao = { id: string; nome: string; zonaNome: string };

export type RotaRow = {
  id: string;
  data: string;
  status: string;
  confirmadaEm: string | null;
  regiaoNome: string;
  zonaNome: string;
  equipeNome: string;
  responsavelNome: string;
  /** Equipe da rota — filtra os técnicos oferecidos ao adicionar parada (0062). */
  equipeId: string;
  rts: {
    rtId: string;
    codigo: string;
    endereco: string;
    tecnicoId: string | null;
    tecnicoNome: string | null;
    /** Atendentes além do principal (migration 0050, 14/09/2026). */
    tecnicosExtraNomes: string[];
    /** Algum serviço da parada está em execução/revisão (remover cancela esse serviço). */
    emAndamento: boolean;
    /** Algum serviço da parada já foi concluído/validado (fica na Validação mesmo removendo a parada). */
    concluida: boolean;
  }[];
  podeCorrigirData: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  planejada: "Planejada",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatoHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function StatusRotaBadge({ status }: { status: string }) {
  const cancelada = status === "cancelada";
  return (
    <StatusDot
      label={STATUS_LABEL[status] ?? status}
      dotClassName={cancelada ? "border border-text-tertiary" : "bg-text-tertiary"}
      textClassName={cancelada ? "text-text-tertiary" : "text-text-secondary"}
    />
  );
}

export function RotasConfirmadasManager({
  rotas,
  regioes,
  rtsDisponiveis,
  tecnicos,
  hoje,
}: {
  rotas: RotaRow[];
  regioes: Regiao[];
  rtsDisponiveis: RtOpcao[];
  tecnicos: TecnicoOpcao[];
  /** Data de hoje (AAAA-MM-DD) calculada no servidor — rota passada não é editável. */
  hoje: string;
}) {
  const [dataFiltro, setDataFiltro] = useState("");
  const [regiaoFiltro, setRegiaoFiltro] = useState("todas");
  const [equipeFiltro, setEquipeFiltro] = useState("todas");
  const [rotaSelecionada, setRotaSelecionada] = useState<RotaRow | null>(null);
  const [rotaCorrigindo, setRotaCorrigindo] = useState<RotaRow | null>(null);
  const [corrigirInstancia, setCorrigirInstancia] = useState(0);
  const [rotaCancelando, setRotaCancelando] = useState<RotaRow | null>(null);
  const [cancelarInstancia, setCancelarInstancia] = useState(0);
  // Editar paradas (0062): guarda só o id e deriva a linha de `rotas` — assim
  // a lista de paradas dentro do diálogo acompanha o revalidatePath depois
  // de adicionar/remover, em vez de congelar no estado de quando abriu.
  const [rotaEditandoId, setRotaEditandoId] = useState<string | null>(null);
  const [editarInstancia, setEditarInstancia] = useState(0);
  const rotaEditando = rotaEditandoId ? (rotas.find((r) => r.id === rotaEditandoId) ?? null) : null;

  const equipesDisponiveis = useMemo(
    () => [...new Set(rotas.map((r) => r.equipeNome))].sort(),
    [rotas],
  );
  const zonas = useMemo(() => [...new Set(regioes.map((r) => r.zonaNome))], [regioes]);

  const linhasFiltradas = useMemo(() => {
    return rotas.filter((r) => {
      if (dataFiltro && r.data !== dataFiltro) return false;
      if (regiaoFiltro !== "todas" && r.regiaoNome !== regiaoFiltro) return false;
      if (equipeFiltro !== "todas" && r.equipeNome !== equipeFiltro) return false;
      return true;
    });
  }, [rotas, dataFiltro, regiaoFiltro, equipeFiltro]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="filtro-data-rota">
          Filtrar por data
        </label>
        <input
          id="filtro-data-rota"
          type="date"
          value={dataFiltro}
          onChange={(e) => setDataFiltro(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />

        <label className="sr-only" htmlFor="filtro-regiao-historico">
          Filtrar por região
        </label>
        <select
          id="filtro-regiao-historico"
          value={regiaoFiltro}
          onChange={(e) => setRegiaoFiltro(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="todas">Todas as regiões</option>
          {zonas.map((zonaNome) => (
            <optgroup key={zonaNome} label={zonaNome}>
              {regioes
                .filter((r) => r.zonaNome === zonaNome)
                .map((r) => (
                  <option key={r.id} value={r.nome}>
                    {r.nome}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>

        <label className="sr-only" htmlFor="filtro-equipe-historico">
          Filtrar por equipe
        </label>
        <select
          id="filtro-equipe-historico"
          value={equipeFiltro}
          onChange={(e) => setEquipeFiltro(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="todas">Todas as equipes</option>
          {equipesDisponiveis.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>

        {(dataFiltro || regiaoFiltro !== "todas" || equipeFiltro !== "todas") && (
          <button
            type="button"
            onClick={() => {
              setDataFiltro("");
              setRegiaoFiltro("todas");
              setEquipeFiltro("todas");
            }}
            className={`text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING} ${TAP_TARGET}`}
          >
            Limpar filtros
          </button>
        )}
      </div>

      <p className="mb-2 text-xs text-text-tertiary" role="status">
        {linhasFiltradas.length} de {rotas.length} rotas
      </p>

      <div className="overflow-x-auto rounded-[var(--radius-md)] bg-surface shadow-lift">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-text-tertiary">
              <th scope="col" className="px-4 py-2.5 font-medium">Data</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Região</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Equipe</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Responsável</th>
              <th scope="col" className="px-4 py-2.5 font-medium">RTs</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {linhasFiltradas.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 align-top whitespace-nowrap text-text-primary">
                  {formatoData.format(new Date(`${r.data}T00:00:00`))}
                </td>
                <td className="px-4 py-2.5 align-top text-text-secondary">
                  <p>{r.regiaoNome}</p>
                  <p className="mt-0.5 text-xs text-text-tertiary">{r.zonaNome}</p>
                </td>
                <td className="px-4 py-2.5 align-top text-text-secondary">{r.equipeNome}</td>
                <td className="px-4 py-2.5 align-top text-text-secondary">{r.responsavelNome}</td>
                <td className="px-4 py-2.5 align-top text-text-secondary">
                  {r.rts.length} RT{r.rts.length === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-2.5 align-top">
                  <StatusRotaBadge status={r.status} />
                </td>
                <td className="px-4 py-2.5 align-top">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    {r.podeCorrigirData && (
                      <button
                        type="button"
                        onClick={() => {
                          setCorrigirInstancia((n) => n + 1);
                          setRotaCorrigindo(r);
                        }}
                        aria-label={`Corrigir data da rota de ${formatoData.format(new Date(`${r.data}T00:00:00`))}`}
                        className={`text-xs font-medium text-accent transition-colors hover:text-accent-hover ${FOCUS_RING} ${TAP_TARGET}`}
                      >
                        Corrigir data
                      </button>
                    )}
                    {r.status === "confirmada" && r.data >= hoje && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditarInstancia((n) => n + 1);
                          setRotaEditandoId(r.id);
                        }}
                        aria-label={`Editar paradas da rota de ${formatoData.format(new Date(`${r.data}T00:00:00`))}`}
                        className={`text-xs font-medium text-accent transition-colors hover:text-accent-hover ${FOCUS_RING} ${TAP_TARGET}`}
                      >
                        Editar paradas
                      </button>
                    )}
                    {r.podeCorrigirData && r.status !== "cancelada" && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelarInstancia((n) => n + 1);
                          setRotaCancelando(r);
                        }}
                        aria-label={`Cancelar a rota de ${formatoData.format(new Date(`${r.data}T00:00:00`))}`}
                        className={`text-xs font-medium text-text-tertiary transition-colors hover:text-danger ${FOCUS_RING} ${TAP_TARGET}`}
                      >
                        Cancelar rota
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRotaSelecionada(r)}
                      aria-label={`Ver detalhes da rota de ${formatoData.format(new Date(`${r.data}T00:00:00`))}`}
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
                  Nenhuma rota confirmada encontrada com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={rotaSelecionada !== null}
        title={rotaSelecionada ? `Rota de ${formatoData.format(new Date(`${rotaSelecionada.data}T00:00:00`))}` : ""}
        onClose={() => setRotaSelecionada(null)}
      >
        {rotaSelecionada && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-text-tertiary">Região</dt>
                <dd className="text-text-primary">{rotaSelecionada.regiaoNome}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-tertiary">Equipe</dt>
                <dd className="text-text-primary">{rotaSelecionada.equipeNome}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-tertiary">Responsável</dt>
                <dd className="text-text-primary">{rotaSelecionada.responsavelNome}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-tertiary">Confirmada em</dt>
                <dd className="text-text-primary">
                  {rotaSelecionada.confirmadaEm
                    ? formatoHora.format(new Date(rotaSelecionada.confirmadaEm))
                    : "—"}
                </dd>
              </div>
            </dl>

            <div>
              <p className="mb-2 text-xs font-medium text-text-secondary">
                RTs na ordem confirmada ({rotaSelecionada.rts.length})
              </p>
              <ol className="flex flex-col gap-2">
                {rotaSelecionada.rts.map((rt, indice) => (
                  <li
                    key={`${rt.codigo}-${indice}`}
                    className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-2.5 py-1.5"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-on-accent">
                      {indice + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <PlacaRt codigo={rt.codigo} className="h-5 text-[11px]" />
                        <span className="truncate text-xs text-text-tertiary">{rt.endereco}</span>
                      </div>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-text-tertiary">
                      {rt.tecnicoNome ?? "— (rota anterior à atribuição por RT)"}
                      {rt.tecnicosExtraNomes.length > 0 && (
                        <span
                          className="inline-flex h-5 items-center rounded-full bg-accent-tint px-1.5 text-[11px] font-semibold text-accent-on-tint"
                          title={`Também vinculados: ${rt.tecnicosExtraNomes.join(", ")}`}
                        >
                          +{rt.tecnicosExtraNomes.length}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex justify-end border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setRotaSelecionada(null)}
                className={`text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING}`}
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
      <EditarParadasDialog
        key={`editar-${editarInstancia}`}
        open={rotaEditando !== null}
        rotaId={rotaEditando?.id ?? null}
        rotaData={rotaEditando?.data ?? null}
        equipeId={rotaEditando?.equipeId ?? null}
        equipeNome={rotaEditando?.equipeNome ?? ""}
        paradas={(rotaEditando?.rts ?? []).map((p) => ({
          rtId: p.rtId,
          codigo: p.codigo,
          endereco: p.endereco,
          tecnicoNome: p.tecnicoNome,
          emAndamento: p.emAndamento,
          concluida: p.concluida,
        }))}
        rtsDisponiveis={rtsDisponiveis}
        tecnicos={tecnicos}
        onClose={() => setRotaEditandoId(null)}
      />

      <CancelarRotaDialog
        key={`cancelar-${cancelarInstancia}`}
        open={rotaCancelando !== null}
        rotaId={rotaCancelando?.id ?? null}
        descricao={
          rotaCancelando ? formatoData.format(new Date(`${rotaCancelando.data}T00:00:00`)) : ""
        }
        quantidadeRts={rotaCancelando?.rts.length ?? 0}
        onClose={() => setRotaCancelando(null)}
      />

      <CorrigirDataDialog
        key={corrigirInstancia}
        open={rotaCorrigindo !== null}
        rotaId={rotaCorrigindo?.id ?? null}
        dataAtual={rotaCorrigindo?.data ?? null}
        onClose={() => setRotaCorrigindo(null)}
        onCorrigido={() => setRotaCorrigindo(null)}
      />
    </div>
  );
}
