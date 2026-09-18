"use client";

import { useActionState, useId, useMemo, useState, useTransition } from "react";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { PlacaRt, nomeSemCodigo } from "@/lib/ui/placa-rt";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import {
  DANGER_BUTTON,
  FIELD_INPUT,
  FIELD_LABEL,
  FOCUS_RING,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  TAP_TARGET,
} from "@/lib/ui/styles";
import {
  adicionarParadaRota,
  buscarRtPorProtocolo,
  listarChamadosElegiveis,
  removerParadaRota,
  type ActionState,
  type ChamadoElegivel,
} from "./actions";

// Editar paradas de uma rota confirmada (migration 0062, 18/09/2026).
//
// Duas ações no mesmo diálogo, porque o gerente pensa nelas juntas ("tira a
// SRT 14 e põe a SRT 33"): a lista de paradas atual, cada uma com "Remover"
// (pede motivo inline, confirma na hora), e um formulário "Adicionar RT"
// embaixo — RT (só as que não estão na rota), técnico (só os da equipe da
// rota), e os chamados elegíveis daquela RT (marcados por padrão; a lista
// vem do servidor ao escolher a RT) com a categoria de cada leva.
//
// O que a tela NÃO promete: reordenar paradas (a ordem real do dia vem da
// rota otimizada no Google Maps) e mexer em parada já iniciada (essa é
// reagendada pela Validação/Pendências — a função do banco recusa, e o
// botão nem aparece).

export type ParadaEditavel = {
  rtId: string;
  codigo: string;
  endereco: string;
  tecnicoNome: string | null;
  /** Serviço em execução/revisão — remover cancela esse atendimento. */
  emAndamento: boolean;
  /** Serviço já concluído/validado — fica na Validação mesmo removendo a parada. */
  concluida: boolean;
};

export type RtOpcao = { id: string; codigo: string; nome: string; bairro: string | null; regiaoNome: string };
export type TecnicoOpcao = { id: string; nome: string; equipeId: string | null };

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function RemoverParada({
  rotaId,
  parada,
  onRemovido,
}: {
  rotaId: string;
  parada: ParadaEditavel;
  onRemovido: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [, startEnvio] = useTransition();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(removerParadaRota, {
    error: null,
  });
  const idMotivo = useId();

  // Sucesso = a action voltou sem erro depois de estar pendente (mesmo hook
  // dos outros diálogos; a lista acima atualiza pelo revalidatePath).
  useCloseOnSuccess(isPending, state.error, () => {
    setConfirmando(false);
    onRemovido();
  });

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        aria-label={`Remover ${parada.codigo} da rota`}
        className={`text-xs font-medium text-text-tertiary transition-colors hover:text-danger ${FOCUS_RING} ${TAP_TARGET}`}
      >
        Remover
      </button>
    );
  }

  return (
    <form
      // Ver o comentário no form de adicionar: sem reset automático do motivo
      // quando a função do banco recusa (o gerente corrige e reenvia).
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        startEnvio(() => formAction(dados));
      }}
      className="mt-2 flex w-full flex-col gap-2 rounded-[var(--radius-sm)] bg-danger-tint p-3"
    >
      <input type="hidden" name="rotaId" value={rotaId} />
      <input type="hidden" name="rtId" value={parada.rtId} />
      <label htmlFor={idMotivo} className={FIELD_LABEL}>
        Motivo pra tirar {parada.codigo} desta rota
      </label>
      <input
        id={idMotivo}
        name="motivo"
        required
        autoFocus
        placeholder="Ex.: morador não estará em casa hoje"
        className={FIELD_INPUT}
      />
      <p className="text-xs text-text-secondary">
        {parada.emAndamento
          ? "Atenção: o técnico já começou aqui — o atendimento em andamento é cancelado e o chamado volta a ficar disponível pra próxima rota."
          : "Os chamados dela saem da lista do técnico e voltam a ficar disponíveis pra próxima rota."}
        {parada.concluida && " O que já foi concluído nesta parada continua na Validação."}
      </p>
      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={isPending}
          className={`${SECONDARY_BUTTON} h-8 px-3 text-xs`}
        >
          Voltar
        </button>
        <button type="submit" disabled={isPending} className={`${DANGER_BUTTON} h-8 px-3 text-xs`}>
          {isPending ? "Removendo…" : "Remover parada"}
        </button>
      </div>
    </form>
  );
}

export function EditarParadasDialog({
  open,
  rotaId,
  rotaData,
  equipeId,
  equipeNome,
  paradas,
  rtsDisponiveis,
  tecnicos,
  onClose,
}: {
  open: boolean;
  rotaId: string | null;
  rotaData: string | null;
  equipeId: string | null;
  equipeNome: string;
  paradas: ParadaEditavel[];
  rtsDisponiveis: RtOpcao[];
  tecnicos: TecnicoOpcao[];
  onClose: () => void;
}) {
  const uid = useId();
  const [rtEscolhida, setRtEscolhida] = useState("");
  const [buscaRt, setBuscaRt] = useState("");
  const [buscandoProtocolo, startBuscaProtocolo] = useTransition();
  const [avisoBusca, setAvisoBusca] = useState<string | null>(null);
  const [tecnicoEscolhido, setTecnicoEscolhido] = useState("");
  const [categoria, setCategoria] = useState<"concluir_hoje" | "revisao_tecnica">("concluir_hoje");
  const [chamados, setChamados] = useState<ChamadoElegivel[] | null>(null);
  const [erroChamados, setErroChamados] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [buscando, startBuscando] = useTransition();
  const [, startEnvio] = useTransition();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(adicionarParadaRota, {
    error: null,
  });
  const [adicionouAgora, setAdicionouAgora] = useState<string | null>(null);

  const naRota = useMemo(() => new Set(paradas.map((p) => p.rtId)), [paradas]);
  const rtsForaDaRota = useMemo(
    () => rtsDisponiveis.filter((rt) => !naRota.has(rt.id)),
    [rtsDisponiveis, naRota],
  );
  // Resultados da busca de RT: por número ("14", "SRT 14"), nome ou bairro.
  // Protocolo de chamado (5+ dígitos) vai ao servidor descobrir a RT dona.
  const resultadosRt = useMemo(() => {
    const q = buscaRt.trim().toLowerCase();
    if (!q) return [];
    const digitos = q.replace(/\D/g, "");
    const soNumero = /^\d+$/.test(q) || /^(s?rt)\s*\d+$/.test(q);
    return rtsForaDaRota
      .filter((rt) => {
        const cod = rt.codigo.toLowerCase();
        const codDigitos = cod.replace(/\D/g, "");
        if (soNumero && digitos) return codDigitos === digitos || (digitos.length < 5 && codDigitos.startsWith(digitos));
        return (
          cod.includes(q) ||
          rt.nome.toLowerCase().includes(q) ||
          (rt.bairro ?? "").toLowerCase().includes(q) ||
          rt.regiaoNome.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [buscaRt, rtsForaDaRota]);
  const rtEscolhidaInfo = rtsDisponiveis.find((rt) => rt.id === rtEscolhida) ?? null;
  const pareceProtocolo = /^\d{5,6}$/.test(buscaRt.trim());

  function buscarPorProtocolo() {
    const termo = buscaRt.trim();
    setAvisoBusca(null);
    startBuscaProtocolo(async () => {
      const r = await buscarRtPorProtocolo(termo);
      if (!r.rtId) {
        setAvisoBusca(`Nenhum chamado com o protocolo #${termo}.`);
        return;
      }
      if (naRota.has(r.rtId)) {
        const rt = rtsDisponiveis.find((x) => x.id === r.rtId);
        setAvisoBusca(`O chamado #${termo} é da ${rt?.codigo ?? "RT"}, que já está nesta rota.`);
        return;
      }
      escolherRt(r.rtId);
    });
  }
  const tecnicosDaEquipe = useMemo(
    () => tecnicos.filter((t) => t.equipeId === equipeId),
    [tecnicos, equipeId],
  );

  // Escolheu a RT → busca os chamados elegíveis dela e marca todos.
  function escolherRt(id: string) {
    setRtEscolhida(id);
    setBuscaRt("");
    setAvisoBusca(null);
    setChamados(null);
    setErroChamados(null);
    setMarcados(new Set());
    if (!id) return;
    startBuscando(async () => {
      const r = await listarChamadosElegiveis(id);
      setChamados(r.chamados);
      setErroChamados(r.error);
      setMarcados(new Set(r.chamados.map((c) => c.id)));
    });
  }

  // Depois de adicionar com sucesso: limpa o formulário e mostra a confirmação
  // (a lista de paradas acima atualiza sozinha pelo revalidatePath).
  useCloseOnSuccess(isPending, state.error, () => {
    const rt = rtsDisponiveis.find((r) => r.id === rtEscolhida);
    setAdicionouAgora(rt ? rt.codigo : "RT");
    setRtEscolhida("");
    setChamados(null);
    setMarcados(new Set());
  });

  const dataFmt = rotaData ? formatoData.format(new Date(`${rotaData}T00:00:00`)) : "";

  return (
    <Modal open={open} title={`Editar paradas — rota de ${dataFmt}`} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <section aria-labelledby={`${uid}-atuais`}>
          <div className="flex items-baseline justify-between">
            <h3 id={`${uid}-atuais`} className="text-sm font-semibold text-text-primary">
              Paradas desta rota
            </h3>
            <span className="text-xs text-text-tertiary">
              {equipeNome} · {paradas.length} RT{paradas.length === 1 ? "" : "s"}
            </span>
          </div>
          <ol className="mt-2 divide-y divide-border">
            {paradas.map((p, i) => (
              <li key={p.rtId} className="flex flex-wrap items-start gap-3 py-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-semibold text-on-accent">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PlacaRt codigo={p.codigo} />
                    <span className="truncate text-xs text-text-secondary">{p.endereco}</span>
                  </div>
                  <p className="mt-1 text-xs text-text-tertiary">
                    {p.tecnicoNome ?? "sem técnico"}
                    {p.emAndamento && (
                      <span className="text-priority-alta"> · atendimento em andamento</span>
                    )}
                    {p.concluida && <span className="text-sla-dentro"> · tem serviço concluído</span>}
                  </p>
                </div>
                {rotaId && <RemoverParada rotaId={rotaId} parada={p} onRemovido={() => undefined} />}
              </li>
            ))}
          </ol>
          {paradas.length === 0 && (
            <p className="mt-2 text-xs text-text-tertiary">Nenhuma parada — a rota foi cancelada.</p>
          )}
          {paradas.length === 1 && (
            <p className="mt-2 text-xs text-text-tertiary">
              Única RT da rota — se ela for removida sem nada concluído, a rota inteira é cancelada.
            </p>
          )}
        </section>

        <section aria-labelledby={`${uid}-add`} className="border-t border-border pt-5">
          <h3 id={`${uid}-add`} className="text-sm font-semibold text-text-primary">
            Adicionar RT à rota
          </h3>
          <p className="mt-1 text-xs text-text-secondary">
            Entra no fim da rota. Só chamados em aberto e ainda sem serviço em outra rota podem entrar.
          </p>

          {adicionouAgora && (
            <p role="status" className="mt-3 rounded-[var(--radius-sm)] bg-success-tint px-3 py-2 text-sm text-success">
              {adicionouAgora} adicionada à rota.
            </p>
          )}

          <form
            // `onSubmit` + transição em vez de `action={formAction}`: com `action`
            // o React 19 zera os campos do form depois da resposta — e aqui os
            // selects são controlados e a lista de chamados depende deles, então
            // o form ficava visualmente vazio com a lista ainda aberta.
            onSubmit={(e) => {
              e.preventDefault();
              const dados = new FormData(e.currentTarget);
              startEnvio(() => formAction(dados));
            }}
            className="mt-3 flex flex-col gap-4"
          >
            <input type="hidden" name="rotaId" value={rotaId ?? ""} />
            <input type="hidden" name="categoria" value={categoria} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="relative flex flex-col gap-1">
                <label htmlFor={`${uid}-rt`} className={FIELD_LABEL}>
                  RT
                </label>
                <input type="hidden" name="rtId" value={rtEscolhida} />
                {rtEscolhidaInfo ? (
                  <div className="flex h-[38px] items-center gap-2 rounded-[var(--radius-sm)] border border-accent bg-accent-tint px-2.5">
                    <PlacaRt codigo={rtEscolhidaInfo.codigo} />
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                      {nomeSemCodigo(rtEscolhidaInfo.nome, rtEscolhidaInfo.codigo)}
                    </span>
                    <button
                      type="button"
                      onClick={() => escolherRt("")}
                      aria-label="Trocar a RT"
                      className={`text-xs font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
                    >
                      trocar
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      id={`${uid}-rt`}
                      type="text"
                      value={buscaRt}
                      onChange={(e) => {
                        setBuscaRt(e.target.value);
                        setAvisoBusca(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (resultadosRt.length === 1) escolherRt(resultadosRt[0].id);
                          else if (pareceProtocolo) buscarPorProtocolo();
                        }
                      }}
                      placeholder="Nº da RT (ex.: 14) ou nº do chamado (ex.: 335072)"
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={resultadosRt.length > 0}
                      aria-controls={`${uid}-rt-lista`}
                      className={FIELD_INPUT}
                    />
                    {(resultadosRt.length > 0 || pareceProtocolo || (buscaRt.trim() && !buscandoProtocolo)) && (
                      <ul
                        id={`${uid}-rt-lista`}
                        role="listbox"
                        className="absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-[var(--radius-sm)] bg-surface p-1 shadow-lift-overlay"
                      >
                        {resultadosRt.map((rt) => (
                          <li key={rt.id} role="option" aria-selected={false}>
                            <button
                              type="button"
                              onClick={() => escolherRt(rt.id)}
                              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm hover:bg-surface-hover"
                            >
                              <PlacaRt codigo={rt.codigo} />
                              <span className="min-w-0 flex-1 truncate text-text-primary">
                                {nomeSemCodigo(rt.nome, rt.codigo)}
                              </span>
                              <span className="shrink-0 text-xs text-text-tertiary">{rt.bairro ?? rt.regiaoNome}</span>
                            </button>
                          </li>
                        ))}
                        {pareceProtocolo && (
                          <li role="option" aria-selected={false}>
                            <button
                              type="button"
                              onClick={buscarPorProtocolo}
                              disabled={buscandoProtocolo}
                              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm text-accent hover:bg-surface-hover disabled:opacity-60"
                            >
                              {buscandoProtocolo ? "Procurando o chamado…" : `Achar a RT do chamado #${buscaRt.trim()}`}
                            </button>
                          </li>
                        )}
                        {resultadosRt.length === 0 && !pareceProtocolo && buscaRt.trim() && (
                          <li className="px-2 py-1.5 text-xs text-text-tertiary">Nenhuma RT fora da rota com esse termo.</li>
                        )}
                      </ul>
                    )}
                  </>
                )}
                {avisoBusca && (
                  <p role="alert" className="text-xs text-danger">
                    {avisoBusca}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${uid}-tec`} className={FIELD_LABEL}>
                  Técnico responsável
                </label>
                <select
                  id={`${uid}-tec`}
                  name="tecnicoId"
                  value={tecnicoEscolhido}
                  onChange={(e) => setTecnicoEscolhido(e.target.value)}
                  required
                  className={FIELD_INPUT}
                >
                  <option value="">Escolha o técnico…</option>
                  {tecnicosDaEquipe.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
                {tecnicosDaEquipe.length === 0 && (
                  <p className="text-xs text-danger">Nenhum técnico ativo nesta equipe.</p>
                )}
              </div>
            </div>

            {rtEscolhida && (
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className={FIELD_LABEL}>Chamados que entram nesta parada</legend>
                {buscando && <p className="text-xs text-text-tertiary">Buscando chamados em aberto…</p>}
                {erroChamados && (
                  <p role="alert" className="text-xs text-danger">
                    {erroChamados}
                  </p>
                )}
                {chamados && chamados.length === 0 && (
                  <p className="text-xs text-text-secondary">
                    Essa RT não tem chamado em aberto disponível — sem chamado não há o que atender, então ela não pode
                    entrar na rota.
                  </p>
                )}
                {chamados && chamados.length > 0 && (
                  <ul className="max-h-56 w-full divide-y divide-border overflow-y-auto rounded-[var(--radius-sm)] border border-border-strong">
                    {chamados.map((c) => (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-surface-hover">
                          <input
                            type="checkbox"
                            name="chamadoIds"
                            value={c.id}
                            checked={marcados.has(c.id)}
                            onChange={(e) => {
                              const prox = new Set(marcados);
                              if (e.target.checked) prox.add(c.id);
                              else prox.delete(c.id);
                              setMarcados(prox);
                            }}
                            className="mt-1 h-4 w-4 accent-[var(--accent)]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-text-primary">{c.assunto}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                              {c.protocolo && <span className="font-mono">#{c.protocolo}</span>}
                              <PrioridadeBadge prioridade={c.prioridade as Prioridade} />
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
            )}

            {rtEscolhida && chamados && chamados.length > 0 && (
              <fieldset className="flex min-w-0 flex-col gap-2">
                <legend className={FIELD_LABEL}>O técnico deve</legend>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["concluir_hoje", "Concluir hoje"],
                      ["revisao_tecnica", "Só revisar (revisão técnica)"],
                    ] as const
                  ).map(([valor, rotulo]) => {
                    const on = categoria === valor;
                    return (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => setCategoria(valor)}
                        aria-pressed={on}
                        className={`${on ? PRIMARY_BUTTON : SECONDARY_BUTTON} h-8 px-3 text-xs`}
                      >
                        {rotulo}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {state.error && (
              <p role="alert" className="text-sm text-danger">
                {state.error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <button type="button" onClick={onClose} disabled={isPending} className={SECONDARY_BUTTON}>
                Fechar
              </button>
              <button
                type="submit"
                disabled={isPending || !rtEscolhida || !tecnicoEscolhido || marcados.size === 0}
                className={PRIMARY_BUTTON}
              >
                {isPending ? "Adicionando…" : `Adicionar à rota${marcados.size > 0 ? ` (${marcados.size})` : ""}`}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Modal>
  );
}
