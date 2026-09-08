"use client";

import { useActionState, useId, useMemo, useState } from "react";
import Link from "next/link";
import { confirmarRota, type ActionState } from "./actions";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";
import { PrioridadeBadge } from "@/app/chamados/prioridade-badge";

type Equipe = { id: string; nome: string };
type RtResumo = { id: string; codigo: string; endereco: string };
type Tecnico = { id: string; nome: string; equipeId: string | null; ativo: boolean };

export type ChamadoDaRt = {
  id: string;
  assunto: string;
  protocolo: string | null;
  prioridade: "emergencial" | "alta" | "normal" | "baixa";
};

const hoje = new Date().toISOString().slice(0, 10);

export function ConfirmarRotaDialog({
  open,
  rtsNaRota,
  chamadosPorRt,
  equipes,
  tecnicos,
  onClose,
  onConfirmado,
}: {
  open: boolean;
  rtsNaRota: RtResumo[];
  chamadosPorRt: Record<string, ChamadoDaRt[]>;
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

  // Tudo marcado por padrão: o comportamento de sempre era levar todos os
  // chamados da RT, então desmarcar é a exceção, não a regra.
  const [desmarcados, setDesmarcados] = useState<Set<string>>(new Set());
  // Conjunto, não uma só: cada RT abre e fecha por conta própria. Com uma
  // variável única, abrir a segunda RT fechava a primeira — que é o que o
  // usuário viu como "não está funcionando".
  const [rtsAbertas, setRtsAbertas] = useState<Set<string>>(new Set());

  function alternarRt(rtId: string) {
    setRtsAbertas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(rtId)) proximo.delete(rtId);
      else proximo.add(rtId);
      return proximo;
    });
  }

  const chamadosSelecionados = useMemo(() => {
    const ids: string[] = [];
    for (const rt of rtsNaRota) {
      for (const c of chamadosPorRt[rt.id] ?? []) {
        if (!desmarcados.has(c.id)) ids.push(c.id);
      }
    }
    return ids;
  }, [rtsNaRota, chamadosPorRt, desmarcados]);

  function alternar(chamadoId: string) {
    setDesmarcados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chamadoId)) proximo.delete(chamadoId);
      else proximo.add(chamadoId);
      return proximo;
    });
  }

  const uid = useId();
  const idData = `${uid}-data`;
  const idEquipe = `${uid}-equipe`;

  // Cada RT da rota precisa de um técnico responsável (decisão de produto,
  // 17/08/2026: atribuição é por parada, não por chamado individual) — a
  // lista de técnicos disponíveis depende de qual equipe está selecionada,
  // então esse select vira controlado (o resto do form continua
  // não-controlado, via defaultValue/FormData, mesmo padrão do resto do app).
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
            Nenhuma equipe ativa cadastrada ainda — cadastre uma equipe antes
            de confirmar a rota, pra saber quem vai executá-la.
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
          {/* A escolha do gerente. Ausente = todos os elegíveis (0033). */}
          <input
            type="hidden"
            name="chamadoIds"
            value={JSON.stringify(chamadosSelecionados)}
          />
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
            {equipeId && tecnicosDaEquipe.length === 0 ? (
              <div className="rounded-[var(--radius-sm)] border border-dashed border-border-strong bg-surface-input p-3 text-xs text-text-tertiary">
                Nenhum técnico ativo vinculado a essa equipe ainda.{" "}
                <Link href="/equipes" className={`font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
                  Ir para Equipes →
                </Link>
              </div>
            ) : (
              <ol className="flex flex-col gap-2">
                {rtsNaRota.map((rt, indice) => {
                  const idTecnico = `${uid}-tecnico-${rt.id}`;
                  const chamados = chamadosPorRt[rt.id] ?? [];
                  const marcadosNaRt = chamados.filter((c) => !desmarcados.has(c.id)).length;
                  const aberta = rtsAbertas.has(rt.id);
                  return (
                    <li
                      key={rt.id}
                      className="rounded-[var(--radius-sm)] border border-border"
                    >
                      {/* O PRÓPRIO código da RT é o que abre e fecha a lista
                          de chamados (pedido do usuário): clicou em "SRT 50",
                          expande; clicou de novo, volta a ser só "SRT 50". */}
                      <button
                        type="button"
                        onClick={() => alternarRt(rt.id)}
                        aria-expanded={aberta}
                        className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] p-2 text-left transition-colors hover:bg-surface-input ${FOCUS_RING}`}
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-semibold text-white">
                          {indice + 1}
                        </span>
                        <span aria-hidden="true" className="text-xs text-text-tertiary">
                          {aberta ? "▾" : "▸"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs">
                          <span className="font-mono font-semibold text-text-primary">{rt.codigo}</span>{" "}
                          <span className="text-text-tertiary">{rt.endereco}</span>
                        </span>
                        <span className="shrink-0 text-xs text-text-tertiary">
                          {chamados.length === 0
                            ? "sem chamado"
                            : `${marcadosNaRt}/${chamados.length}`}
                        </span>
                      </button>

                      <div className="px-2 pb-2">
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
                          className={FIELD_INPUT}
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

                        {aberta &&
                          (chamados.length === 0 ? (
                            <p className="mt-2 text-xs text-text-tertiary">
                              Sem chamado em aberto nessa RT.
                            </p>
                          ) : (
                            <ul className="mt-2 flex flex-col gap-1">
                              {chamados.map((c) => {
                                const idCheck = `${uid}-ch-${c.id}`;
                                return (
                                  <li key={c.id} className="flex items-start gap-2">
                                    <input
                                      id={idCheck}
                                      type="checkbox"
                                      checked={!desmarcados.has(c.id)}
                                      onChange={() => alternar(c.id)}
                                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                                    />
                                    <label
                                      htmlFor={idCheck}
                                      className="min-w-0 flex-1 cursor-pointer text-xs"
                                    >
                                      {c.protocolo && (
                                        <span className="font-mono text-text-tertiary">#{c.protocolo} </span>
                                      )}
                                      <span className="text-text-primary">{c.assunto}</span>
                                    </label>
                                    <PrioridadeBadge prioridade={c.prioridade} />
                                  </li>
                                );
                              })}
                            </ul>
                          ))}
                      </div>
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
