"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { alternarAtivo } from "./actions";
import { RtCreateDialog } from "./rt-create-dialog";
import { RtEditDialog } from "./rt-edit-dialog";
import { RtEnderecoDialog } from "./rt-endereco-dialog";
import { StatusBadge } from "./status-badge";
import { FOCUS_RING, TAP_TARGET } from "@/lib/ui/styles";

type RtRow = {
  id: string;
  codigo: string;
  nome: string;
  endereco: string;
  bairro: string;
  latitude: number;
  longitude: number;
  ativo: boolean;
  regiao_id: string;
  caps_id: string;
  regiaoNome: string;
  zonaNome: string;
  capsNome: string;
};
type Regiao = { id: string; nome: string; zonaNome: string };
type Caps = { id: string; nome: string };

type ModoDialogo = "nenhum" | "criar" | "editar" | "endereco";

export function RtsManager({
  rts,
  regioes,
  caps,
}: {
  rts: RtRow[];
  regioes: Regiao[];
  caps: Caps[];
}) {
  const zonas = useMemo(() => [...new Set(regioes.map((r) => r.zonaNome))], [regioes]);

  const [busca, setBusca] = useState("");
  const [zonaFiltro, setZonaFiltro] = useState("todas");
  const [modoDialogo, setModoDialogo] = useState<ModoDialogo>("nenhum");
  const [rtSelecionada, setRtSelecionada] = useState<RtRow | null>(null);
  // Incrementa a cada abertura — força o diálogo a remontar do zero
  // (useActionState e defaultValue só aplicam valor inicial na montagem;
  // sem isso, reabrir pra editar um registro diferente mantinha os
  // campos/estado da abertura anterior).
  const [dialogInstancia, setDialogInstancia] = useState(0);
  const [idPendente, setIdPendente] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const linhasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return rts.filter((rt) => {
      if (zonaFiltro !== "todas" && rt.zonaNome !== zonaFiltro) return false;
      if (!termo) return true;
      return (
        rt.codigo.toLowerCase().includes(termo) ||
        rt.nome.toLowerCase().includes(termo) ||
        rt.endereco.toLowerCase().includes(termo) ||
        rt.bairro.toLowerCase().includes(termo) ||
        rt.capsNome.toLowerCase().includes(termo)
      );
    });
  }, [rts, busca, zonaFiltro]);

  function abrir(modo: ModoDialogo, rt: RtRow | null = null) {
    setRtSelecionada(rt);
    setModoDialogo(modo);
    setDialogInstancia((n) => n + 1);
  }

  function fechar() {
    setModoDialogo("nenhum");
  }

  function handleToggleAtivo(rt: RtRow) {
    setIdPendente(rt.id);
    startTransition(async () => {
      await alternarAtivo(rt.id, !rt.ativo);
      setIdPendente(null);
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="busca-rts">
          Buscar RTs
        </label>
        <input
          id="busca-rts"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código, nome, bairro, endereço ou CAPS..."
          className="min-w-64 flex-1 rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />

        <label className="sr-only" htmlFor="filtro-zona">
          Filtrar por zona
        </label>
        <select
          id="filtro-zona"
          value={zonaFiltro}
          onChange={(e) => setZonaFiltro(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="todas">Todas as zonas</option>
          {zonas.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => abrir("criar")}
          className={`ml-auto rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover ${FOCUS_RING}`}
        >
          + Nova RT
        </button>
      </div>

      <p className="mb-2 text-xs text-text-tertiary" role="status">
        {linhasFiltradas.length} de {rts.length} RTs
      </p>

      <div className="overflow-x-auto rounded-[var(--radius-md)] bg-surface shadow-lift">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-text-tertiary">
              <th scope="col" className="px-4 py-2.5 font-medium">Código</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Nome / endereço</th>
              <th scope="col" className="px-4 py-2.5 font-medium">CAPS</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {linhasFiltradas.map((rt) => (
              <tr key={rt.id}>
                <td className="px-4 py-2.5 align-top font-mono text-xs tabular-nums">
                  <Link
                    href={`/rts/${rt.id}`}
                    className={`text-accent hover:text-accent-hover hover:underline ${FOCUS_RING}`}
                  >
                    {rt.codigo}
                  </Link>
                </td>
                <td className="px-4 py-2.5 align-top">
                  <p className="text-text-primary">{rt.nome}</p>
                  <p className="mt-0.5 text-xs text-text-tertiary">{rt.endereco}</p>
                </td>
                <td className="px-4 py-2.5 align-top text-text-secondary">
                  <p>{rt.capsNome}</p>
                  <p className="mt-0.5 text-xs text-text-tertiary">{rt.bairro}</p>
                </td>
                <td className="px-4 py-2.5 align-top">
                  <StatusBadge ativo={rt.ativo} />
                </td>
                <td className="px-4 py-2.5 align-top">
                  <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => abrir("editar", rt)}
                      aria-label={`Editar RT ${rt.codigo}`}
                      className={`text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING} ${TAP_TARGET}`}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => abrir("endereco", rt)}
                      aria-label={`Trocar endereço da RT ${rt.codigo}`}
                      className={`text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING} ${TAP_TARGET}`}
                    >
                      Trocar endereço
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAtivo(rt)}
                      disabled={idPendente === rt.id}
                      aria-label={`${rt.ativo ? "Desativar" : "Ativar"} RT ${rt.codigo}`}
                      className={`text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${TAP_TARGET}`}
                    >
                      {idPendente === rt.id ? "..." : rt.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {linhasFiltradas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-text-tertiary">
                  Nenhuma RT encontrada com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RtCreateDialog
        key={`criar-${dialogInstancia}`}
        open={modoDialogo === "criar"}
        regioes={regioes}
        caps={caps}
        onClose={fechar}
      />
      <RtEditDialog
        key={`editar-${dialogInstancia}`}
        open={modoDialogo === "editar"}
        rt={rtSelecionada}
        caps={caps}
        onClose={fechar}
      />
      <RtEnderecoDialog
        key={`endereco-${dialogInstancia}`}
        open={modoDialogo === "endereco"}
        rt={rtSelecionada}
        regioes={regioes}
        onClose={fechar}
      />
    </div>
  );
}
