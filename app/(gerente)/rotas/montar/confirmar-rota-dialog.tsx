"use client";

import { useActionState, useId, useMemo, useState } from "react";
import Link from "next/link";
import { confirmarRota, type ActionState } from "./actions";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";

type Equipe = { id: string; nome: string };
type RtResumo = { id: string; codigo: string; endereco: string };
type Tecnico = { id: string; nome: string; equipeId: string | null; ativo: boolean };

const hoje = new Date().toISOString().slice(0, 10);

// A seleção manual de chamados por técnico (checkbox por RT, migration 0033)
// foi removida a pedido do usuário (09/09/2026): o técnico recebe TODOS os
// chamados em aberto da RT. `fn_confirmar_rota` sem `p_chamado_ids` = todos os
// elegíveis (comportamento de sempre). A 0033 continua no banco, inofensiva.
export function ConfirmarRotaDialog({
  open,
  rtsNaRota,
  equipes,
  tecnicos,
  onClose,
  onConfirmado,
}: {
  open: boolean;
  rtsNaRota: RtResumo[];
  equipes: Equipe[];
  tecnicos: Tecnico[];
  onClose: () => void;
  onConfirmado: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(confirmarRota, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, () => {
    onConfirmado();
    onClose();
  });

  const uid = useId();
  const idData = `${uid}-data`;
  const idEquipe = `${uid}-equipe`;

  // Cada RT da rota precisa de um técnico responsável (decisão de produto,
  // 17/08/2026: atribuição é por parada, não por chamado individual). A lista
  // de técnicos disponíveis depende da equipe selecionada, então esse select é
  // controlado — o resto do form segue não-controlado via FormData.
  const [equipeId, setEquipeId] = useState("");
  const [tecnicoPorRt, setTecnicoPorRt] = useState<Record<string, string>>({});

  const tecnicosDaEquipe = useMemo(
    () => tecnicos.filter((t) => t.ativo && t.equipeId === equipeId),
    [tecnicos, equipeId],
  );

  function handleTrocarEquipe(novaEquipeId: string) {
    setEquipeId(novaEquipeId);
    setTecnicoPorRt({});
  }

  return (
    <Modal open={open} title="Confirmar rota do dia" onClose={onClose}>
      {equipes.length === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Nenhuma equipe ativa cadastrada ainda — cadastre uma equipe antes de
            confirmar a rota, pra saber quem vai executá-la.
          </p>
          <Link
            href="/equipes"
            className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
          >
            Ir para Equipes →
          </Link>
        </div>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="rtIds" value={JSON.stringify(rtsNaRota.map((rt) => rt.id))} />
          <input
            type="hidden"
            name="tecnicoIds"
            value={JSON.stringify(rtsNaRota.map((rt) => tecnicoPorRt[rt.id] ?? ""))}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor={idData} className={FIELD_LABEL}>
              Data
            </label>
            <input
              id={idData}
              name="data"
              type="date"
              defaultValue={hoje}
              required
              className={FIELD_INPUT}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={idEquipe} className={FIELD_LABEL}>
              Equipe responsável
            </label>
            <select
              id={idEquipe}
              name="equipeId"
              value={equipeId}
              onChange={(e) => handleTrocarEquipe(e.target.value)}
              required
              className={FIELD_INPUT}
            >
              <option value="" disabled>
                Selecione...
              </option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>
              RTs da rota e técnico responsável ({rtsNaRota.length})
            </span>
            <p className="text-xs text-text-tertiary">
              O técnico fica com todos os chamados em aberto de cada RT.
            </p>
            {equipeId && tecnicosDaEquipe.length === 0 ? (
              <div className="mt-1 rounded-[var(--radius-sm)] border border-dashed border-border-strong bg-surface-input p-3 text-xs text-text-tertiary">
                Nenhum técnico ativo vinculado a essa equipe ainda.{" "}
                <Link href="/equipes" className={`font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
                  Ir para Equipes →
                </Link>
              </div>
            ) : (
              <ol className="mt-1 flex flex-col gap-2">
                {rtsNaRota.map((rt, indice) => {
                  const idTecnico = `${uid}-tecnico-${rt.id}`;
                  return (
                    <li key={rt.id} className="rounded-[var(--radius-sm)] border border-border p-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-semibold text-white">
                          {indice + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs">
                          <span className="font-mono font-semibold text-text-primary">{rt.codigo}</span>{" "}
                          <span className="text-text-tertiary">{rt.endereco}</span>
                        </span>
                      </div>
                      <label htmlFor={idTecnico} className="sr-only">
                        Técnico responsável por {rt.codigo}
                      </label>
                      <select
                        id={idTecnico}
                        value={tecnicoPorRt[rt.id] ?? ""}
                        onChange={(e) =>
                          setTecnicoPorRt((atual) => ({ ...atual, [rt.id]: e.target.value }))
                        }
                        disabled={!equipeId}
                        required
                        className={`${FIELD_INPUT} mt-2`}
                      >
                        <option value="" disabled>
                          {equipeId ? "Técnico responsável..." : "Selecione a equipe primeiro"}
                        </option>
                        {tecnicosDaEquipe.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}

          <div className="mt-1 flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className={`text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              {isPending ? "Confirmando..." : "Confirmar rota"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
