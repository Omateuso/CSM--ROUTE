"use client";

import { useState, useTransition } from "react";
import { EquipeCreateDialog } from "./equipe-create-dialog";
import { EquipeEditDialog } from "./equipe-edit-dialog";
import { alternarAtivoEquipe, alternarAtivoTecnico, atualizarEquipeTecnico } from "./actions";
import { FOCUS_RING, TAP_TARGET } from "@/lib/ui/styles";
import { StatusDot } from "@/lib/ui/status-dot";

export type Zona = { id: string; nome: string };
export type Responsavel = { id: string; nome: string };

export type EquipeRow = {
  id: string;
  nome: string;
  numero: number;
  ativo: boolean;
  zonaPadraoId: string | null;
  responsavelId: string | null;
  zonaPadraoNome: string | null;
  responsavelNome: string | null;
};

export type TecnicoRow = {
  id: string;
  nome: string;
  telefone: string | null;
  equipeId: string | null;
  ativo: boolean;
};

type ModoDialogo = "nenhum" | "criar" | "editar";

export function EquipesManager({
  equipes,
  zonas,
  responsaveis,
  tecnicos,
}: {
  equipes: EquipeRow[];
  zonas: Zona[];
  responsaveis: Responsavel[];
  tecnicos: TecnicoRow[];
}) {
  const [modoDialogo, setModoDialogo] = useState<ModoDialogo>("nenhum");
  const [equipeSelecionada, setEquipeSelecionada] = useState<EquipeRow | null>(null);
  const [dialogInstancia, setDialogInstancia] = useState(0);
  const [idPendente, setIdPendente] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function abrir(modo: ModoDialogo, equipe: EquipeRow | null = null) {
    setEquipeSelecionada(equipe);
    setModoDialogo(modo);
    setDialogInstancia((n) => n + 1);
  }

  function fechar() {
    setModoDialogo("nenhum");
  }

  function handleToggleAtivoEquipe(equipe: EquipeRow) {
    setIdPendente(equipe.id);
    startTransition(async () => {
      await alternarAtivoEquipe(equipe.id, !equipe.ativo);
      setIdPendente(null);
    });
  }

  function handleMudarEquipeTecnico(tecnico: TecnicoRow, novaEquipeId: string) {
    setIdPendente(tecnico.id);
    startTransition(async () => {
      await atualizarEquipeTecnico(tecnico.id, novaEquipeId || null);
      setIdPendente(null);
    });
  }

  function handleToggleAtivoTecnico(tecnico: TecnicoRow) {
    setIdPendente(tecnico.id);
    startTransition(async () => {
      await alternarAtivoTecnico(tecnico.id, !tecnico.ativo);
      setIdPendente(null);
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Equipes</h2>
          <button
            type="button"
            onClick={() => abrir("criar")}
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover ${FOCUS_RING}`}
          >
            + Nova equipe
          </button>
        </div>

        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-text-tertiary">
                <th scope="col" className="px-4 py-2.5 font-medium">Nº</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Nome</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Zona padrão</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Responsável</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {equipes.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2.5 align-top font-mono text-text-secondary tabular-nums">{e.numero}</td>
                  <td className="px-4 py-2.5 align-top text-text-primary">{e.nome}</td>
                  <td className="px-4 py-2.5 align-top text-text-secondary">
                    {e.zonaPadraoNome ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 align-top text-text-secondary">
                    {e.responsavelNome ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <StatusDot
                      label={e.ativo ? "Ativa" : "Inativa"}
                      dotClassName={e.ativo ? "bg-text-tertiary" : "border border-text-secondary"}
                      textClassName={e.ativo ? "text-text-tertiary" : "text-text-secondary"}
                    />
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => abrir("editar", e)}
                        aria-label={`Editar equipe ${e.nome}`}
                        className={`text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING} ${TAP_TARGET}`}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleAtivoEquipe(e)}
                        disabled={idPendente === e.id}
                        aria-label={`${e.ativo ? "Desativar" : "Ativar"} equipe ${e.nome}`}
                        className={`text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${TAP_TARGET}`}
                      >
                        {idPendente === e.id ? "..." : e.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {equipes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-text-tertiary">
                    Nenhuma equipe cadastrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-text-primary">Técnicos</h2>
        <p className="mb-4 text-xs text-text-tertiary">
          Vincule cada técnico a uma equipe. Contas de técnico são criadas
          fora desta tela.
        </p>

        <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-text-tertiary">
                <th scope="col" className="px-4 py-2.5 font-medium">Nome</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Telefone</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Equipe</th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tecnicos.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 align-top text-text-primary">
                    {t.nome}
                    {!t.ativo && (
                      <span className="ml-2 text-xs text-text-tertiary">(inativo)</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-top text-text-secondary">
                    {t.telefone ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <label className="sr-only" htmlFor={`equipe-${t.id}`}>
                      Equipe de {t.nome}
                    </label>
                    <select
                      id={`equipe-${t.id}`}
                      value={t.equipeId ?? ""}
                      onChange={(ev) => handleMudarEquipeTecnico(t, ev.target.value)}
                      disabled={idPendente === t.id}
                      className="rounded-[var(--radius-sm)] border border-border bg-surface-input px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">Sem equipe</option>
                      {equipes.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nome}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <div className="flex items-center justify-end whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleAtivoTecnico(t)}
                        disabled={idPendente === t.id}
                        aria-label={`${t.ativo ? "Desativar" : "Ativar"} técnico ${t.nome}`}
                        className={`text-xs font-medium text-text-tertiary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${TAP_TARGET}`}
                      >
                        {t.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {tecnicos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-text-tertiary">
                    Nenhum técnico cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <EquipeCreateDialog
        key={`criar-${dialogInstancia}`}
        open={modoDialogo === "criar"}
        zonas={zonas}
        responsaveis={responsaveis}
        numeroSugerido={Math.max(0, ...equipes.map((e) => e.numero)) + 1}
        onClose={fechar}
      />
      <EquipeEditDialog
        key={`editar-${dialogInstancia}`}
        open={modoDialogo === "editar"}
        equipe={equipeSelecionada}
        zonas={zonas}
        responsaveis={responsaveis}
        onClose={fechar}
      />
    </div>
  );
}
