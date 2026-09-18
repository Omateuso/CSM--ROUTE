"use client";

import { useActionState, useId, useMemo, useState } from "react";
import Link from "next/link";
import { confirmarRota, type ActionState, type ChamadoElegivel } from "./actions";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";
import { PrioridadeBadge } from "@/app/chamados/prioridade-badge";
import { PlacaRt } from "@/lib/ui/placa-rt";

type Equipe = { id: string; nome: string };
type RtResumo = { id: string; codigo: string; endereco: string };
type Tecnico = { id: string; nome: string; equipeId: string | null; ativo: boolean };

const hoje = new Date().toISOString().slice(0, 10);

// Categorização por chamado (migration 0046, pedido do usuário 14/09/2026):
// diferente da seleção manual da 0033 (revertida em 09/09/2026 — lá, o
// chamado fora da lista NÃO ganhava serviço, o técnico nunca via), aqui todo
// chamado elegível SEMPRE ganha serviço — a marcação decide só a categoria.
// Marcado = "concluir hoje" (cobrança de fechar no dia); desmarcado =
// "revisão técnica" (o técnico passa o olho, sem cobrança). Tudo marcado por
// padrão — desmarcar é a exceção.
export function ConfirmarRotaDialog({
  open,
  rtsNaRota,
  chamadosElegiveis,
  equipes,
  tecnicos,
  onClose,
  onConfirmado,
}: {
  open: boolean;
  rtsNaRota: RtResumo[];
  chamadosElegiveis: ChamadoElegivel[];
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

  const chamadosPorRt = useMemo(() => {
    const mapa = new Map<string, ChamadoElegivel[]>();
    for (const c of chamadosElegiveis) {
      const lista = mapa.get(c.rtId) ?? [];
      lista.push(c);
      mapa.set(c.rtId, lista);
    }
    return mapa;
  }, [chamadosElegiveis]);

  // Marcados = "chamados do dia" (concluir_hoje). NENHUM marcado por padrão
  // (pedido do usuário, 14/09/2026) — marcar é a escolha ativa do gerente, o
  // resto vira "revisão técnica" sozinho. Conjunto, não uma variável única
  // por RT — cada RT abre/fecha por conta própria (mesmo motivo já
  // documentado na 0033: uma variável só fazia abrir a segunda RT fechar a
  // primeira).
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [rtsAbertas, setRtsAbertas] = useState<Set<string>>(new Set());

  function alternarRt(rtId: string) {
    setRtsAbertas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(rtId)) proximo.delete(rtId);
      else proximo.add(rtId);
      return proximo;
    });
  }

  function alternarChamado(chamadoId: string) {
    setMarcados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chamadoId)) proximo.delete(chamadoId);
      else proximo.add(chamadoId);
      return proximo;
    });
  }

  // Presente (mesmo vazio) só quando há chamados pra categorizar de verdade —
  // ausente = a busca não achou nada (falhou, ou nenhum chamado elegível) e
  // `confirmarRota` cai no fallback de sempre (tudo concluir_hoje). Com
  // `marcados` vazio por padrão, uma rota confirmada sem nenhuma marcação
  // manda `"[]"` pro servidor — escolha explícita e válida (0046): a RT
  // inteira nasce revisão técnica até o gerente marcar algo.
  const chamadosDiaValue =
    chamadosElegiveis.length > 0
      ? JSON.stringify(chamadosElegiveis.map((c) => c.id).filter((id) => marcados.has(id)))
      : "";

  const uid = useId();
  const idData = `${uid}-data`;
  const idEquipe = `${uid}-equipe`;

  // Cada RT da rota precisa de um técnico responsável (decisão de produto,
  // 17/08/2026: atribuição é por parada, não por chamado individual). A lista
  // de técnicos disponíveis depende da equipe selecionada, então esse select é
  // controlado — o resto do form segue não-controlado via FormData.
  const [equipeId, setEquipeId] = useState("");
  const [tecnicoPorRt, setTecnicoPorRt] = useState<Record<string, string>>({});

  // Mais de um atendente por parada (pedido do usuário, 14/09/2026) — o
  // principal continua em `tecnicoPorRt` (obrigatório, sem mudança); aqui só
  // os EXTRAS, além dele. Os chamados da RT aparecem pra todos.
  const [extrasPorRt, setExtrasPorRt] = useState<Record<string, Set<string>>>({});
  const [extrasAbertos, setExtrasAbertos] = useState<Set<string>>(new Set());

  const tecnicosDaEquipe = useMemo(
    () => tecnicos.filter((t) => t.ativo && t.equipeId === equipeId),
    [tecnicos, equipeId],
  );

  function handleTrocarEquipe(novaEquipeId: string) {
    setEquipeId(novaEquipeId);
    setTecnicoPorRt({});
    setExtrasPorRt({});
  }

  function alternarExtrasAbertos(rtId: string) {
    setExtrasAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(rtId)) proximo.delete(rtId);
      else proximo.add(rtId);
      return proximo;
    });
  }

  function alternarExtra(rtId: string, tecnicoId: string) {
    setExtrasPorRt((atual) => {
      const atuais = new Set(atual[rtId] ?? []);
      if (atuais.has(tecnicoId)) atuais.delete(tecnicoId);
      else atuais.add(tecnicoId);
      return { ...atual, [rtId]: atuais };
    });
  }

  // {"<rtId>": ["<tecnicoId>", ...]} — só as RTs com pelo menos 1 extra.
  // Filtra o próprio principal (se o gerente marcou um extra e depois trocou
  // o principal pra essa mesma pessoa, ela não entra duas vezes — o servidor
  // já ignora duplicata com `on conflict do nothing`, isso é só higiene).
  const tecnicosExtraValue = useMemo(() => {
    const objeto: Record<string, string[]> = {};
    for (const rt of rtsNaRota) {
      const principal = tecnicoPorRt[rt.id];
      const ids = [...(extrasPorRt[rt.id] ?? [])].filter((id) => id !== principal);
      if (ids.length > 0) objeto[rt.id] = ids;
    }
    return JSON.stringify(objeto);
  }, [rtsNaRota, tecnicoPorRt, extrasPorRt]);

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
          <input type="hidden" name="chamadosDia" value={chamadosDiaValue} />
          <input type="hidden" name="tecnicosExtra" value={tecnicosExtraValue} />

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
              {chamadosElegiveis.length > 0
                ? "Toque numa RT e marque os chamados que o técnico precisa concluir hoje. Nenhum vem marcado por padrão — os demais entram como revisão técnica (o técnico visita, mas sem cobrança de fechar no dia)."
                : "O técnico fica com todos os chamados em aberto de cada RT."}
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
                  const chamados = chamadosPorRt.get(rt.id) ?? [];
                  const marcadosNaRt = chamados.filter((c) => marcados.has(c.id)).length;
                  const aberta = rtsAbertas.has(rt.id);
                  return (
                    <li key={rt.id} className="rounded-[var(--radius-sm)] border border-border p-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-semibold text-on-accent">
                          {indice + 1}
                        </span>
                        {chamados.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => alternarRt(rt.id)}
                            aria-expanded={aberta}
                            className={`flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-sm)] py-0.5 text-left ${FOCUS_RING}`}
                          >
                            <span aria-hidden="true" className="text-xs text-text-tertiary">
                              {aberta ? "▾" : "▸"}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs">
                              <PlacaRt codigo={rt.codigo} />{" "}
                              <span className="text-text-tertiary">{rt.endereco}</span>
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                marcadosNaRt > 0
                                  ? "bg-sla-dentro/15 text-sla-dentro"
                                  : "text-text-tertiary"
                              }`}
                            >
                              {marcadosNaRt}/{chamados.length} hoje
                            </span>
                          </button>
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-xs">
                            <PlacaRt codigo={rt.codigo} />{" "}
                            <span className="text-text-tertiary">{rt.endereco}</span>
                          </span>
                        )}
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

                      {equipeId && tecnicosDaEquipe.length > 1 && (
                        <div className="mt-1.5">
                          <button
                            type="button"
                            onClick={() => alternarExtrasAbertos(rt.id)}
                            aria-expanded={extrasAbertos.has(rt.id)}
                            className={`text-[11px] font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
                          >
                            {(extrasPorRt[rt.id]?.size ?? 0) > 0
                              ? `+ ${extrasPorRt[rt.id]!.size} técnico${extrasPorRt[rt.id]!.size === 1 ? "" : "s"} extra`
                              : "+ Vincular outro técnico"}
                          </button>
                          {extrasAbertos.has(rt.id) && (
                            <ul className="mt-1.5 flex flex-col gap-1 rounded-[var(--radius-sm)] border border-dashed border-border-strong p-2">
                              {tecnicosDaEquipe
                                .filter((t) => t.id !== tecnicoPorRt[rt.id])
                                .map((t) => {
                                  const idExtra = `${uid}-extra-${rt.id}-${t.id}`;
                                  const marcado = extrasPorRt[rt.id]?.has(t.id) ?? false;
                                  return (
                                    <li key={t.id} className="flex items-center gap-2">
                                      <input
                                        id={idExtra}
                                        type="checkbox"
                                        checked={marcado}
                                        onChange={() => alternarExtra(rt.id, t.id)}
                                        className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                                      />
                                      <label htmlFor={idExtra} className="cursor-pointer text-xs text-text-primary">
                                        {t.nome}
                                      </label>
                                    </li>
                                  );
                                })}
                            </ul>
                          )}
                        </div>
                      )}

                      {aberta && chamados.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                          {chamados.map((c) => {
                            const idCheck = `${uid}-ch-${c.id}`;
                            const marcado = marcados.has(c.id);
                            return (
                              <li
                                key={c.id}
                                className={`flex items-start gap-2 rounded-[var(--radius-sm)] p-1 ${
                                  marcado ? "bg-sla-dentro/10" : ""
                                }`}
                              >
                                <input
                                  id={idCheck}
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={() => alternarChamado(c.id)}
                                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--sla-dentro)]"
                                />
                                <label
                                  htmlFor={idCheck}
                                  className={`min-w-0 flex-1 cursor-pointer text-xs ${
                                    marcado ? "font-medium text-sla-dentro" : "text-text-primary"
                                  }`}
                                >
                                  {c.tomticketId && (
                                    <span
                                      className={`font-mono ${marcado ? "text-sla-dentro/80" : "text-text-tertiary"}`}
                                    >
                                      #{c.tomticketId}{" "}
                                    </span>
                                  )}
                                  {c.assunto}
                                </label>
                                <PrioridadeBadge prioridade={c.prioridade} />
                              </li>
                            );
                          })}
                        </ul>
                      )}
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
              className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              {isPending ? "Confirmando..." : "Confirmar rota"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
