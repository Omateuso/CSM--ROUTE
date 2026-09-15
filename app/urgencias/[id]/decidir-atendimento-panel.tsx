"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { decidirAtendimento, type ActionState } from "../actions";
import { UrgenciaMapa, type CandidatoMapa } from "./urgencia-mapa";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";
import type { OpcaoAtendimentoUrgencia } from "@/lib/routing/urgencia-impacto";

type Equipe = { id: string; nome: string };
type Tecnico = { id: string; nome: string; equipeId: string | null; ativo: boolean };
type OpcaoLabel = "insercao_rota" | "fim_de_rota" | "otimizado" | "outra_equipe" | "avulsa";

type Escolha = {
  equipeId: string;
  equipeNome: string;
  rotaId: string | null;
  opcaoLabel: OpcaoLabel;
  impactoKm: number | null;
  impactoMin: number | null;
  tecnicoSugeridoId: string | null;
};

function formatarDistancia(km: number, min: number | null): string {
  const texto = `${km.toFixed(1)} km`;
  return min != null ? `${texto} · ~${min} min de carro` : `${texto} (linha reta — sem tempo de carro configurado)`;
}

// "atualizado há N min/h" pra localização estimada (0057) — o gerente
// precisa saber se é uma leitura fresca ou velha antes de confiar nela.
function formatarIdade(isoData: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(isoData).getTime()) / 60000));
  if (minutos < 1) return "atualizada agora";
  if (minutos < 60) return `atualizada há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  return `atualizada há ${horas}h`;
}

// O "coração" do módulo (seções 10-13 do prompt): recomenda por proximidade
// E disponibilidade (nunca só distância — item 10 explícito), mas nunca
// impede a escolha manual. As opções já chegam prontas do servidor
// (calcularImpactoUrgencia, chamado direto em page.tsx — sem round-trip de
// fetch no cliente, mesmo padrão que a Rota Inteligente já usa desde a
// Fase 2 pra não disparar setState dentro de useEffect à toa).
export function DecidirAtendimentoPanel({
  urgenciaId,
  rt,
  opcoes,
  candidatosMapa,
  equipes,
  tecnicos,
}: {
  urgenciaId: string;
  rt: { lat: number; lng: number; codigo: string; endereco: string };
  opcoes: OpcaoAtendimentoUrgencia[];
  candidatosMapa: CandidatoMapa[];
  equipes: Equipe[];
  tecnicos: Tecnico[];
}) {
  const [escolha, setEscolha] = useState<Escolha | null>(null);

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-4">
      <div>
        <p className="text-sm font-semibold text-text-primary">Despachar atendimento</p>
        <p className="mt-1 text-xs text-text-secondary">
          Recomendação por distância e carga de trabalho de hoje — sem GPS ao vivo do técnico. Isso é auxílio, nunca
          obrigação: escolha manualmente quando fizer mais sentido.
        </p>
      </div>

      {opcoes.length > 0 && (
        <div className="h-72 overflow-hidden rounded-[var(--radius-sm)] border border-border">
          <UrgenciaMapa rt={rt} candidatos={candidatosMapa} />
        </div>
      )}

      {opcoes.length === 0 ? (
        <p className="rounded-[var(--radius-sm)] border border-dashed border-border-strong bg-surface-input px-4 py-6 text-center text-xs text-text-tertiary">
          Nenhuma equipe com rota confirmada hoje. Use o atendimento avulso abaixo.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {opcoes.map((o, indice) => {
            const recomendada = indice === 0;
            const menor = Math.min(o.insercao?.distanciaKm ?? Infinity, o.fimDeRota.distanciaKm);
            return (
              <li
                key={o.rotaId}
                className={`rounded-[var(--radius-sm)] border p-3 ${
                  recomendada ? "border-accent bg-accent/5" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {recomendada && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                      RECOMENDADO
                    </span>
                  )}
                  <span className="text-sm font-semibold text-text-primary">{o.equipeNome}</span>
                  <span
                    className={`ml-auto flex items-center gap-1 text-xs ${
                      o.tecnicoOcupadoAgora ? "text-priority-alta" : "text-sla-dentro"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${o.tecnicoOcupadoAgora ? "bg-priority-alta" : "bg-sla-dentro"}`}
                    />
                    {o.tecnicoOcupadoAgora ? "Em atendimento agora" : "Disponível agora"}
                  </span>
                </div>

                <p className="mt-1 text-xs text-text-secondary">
                  {o.tecnicoNome ?? "Técnico não escalado"} ·{" "}
                  {o.proximaParadaCodigo
                    ? `próxima parada ${o.proximaParadaCodigo}`
                    : `rota concluída — última parada ${o.ultimaParadaCodigo}`}{" "}
                  · {o.tecnicoServicosRestantesHoje} atendimento(s) restante(s) hoje
                </p>
                {o.distanciaEstimadaAtualKm != null && (
                  // suppressHydrationWarning: "atualizada há N min" depende
                  // de Date.now() no momento do render — SSR e cliente
                  // rodam em instantes diferentes (a página pode levar
                  // segundos pra hidratar), então o minuto pode mudar entre
                  // os dois e o React acusa mismatch à toa (mesmo padrão já
                  // usado em urgencia-card.tsx pro "N min atrás").
                  <p className="mt-0.5 text-xs text-text-tertiary" suppressHydrationWarning>
                    📍{" "}
                    {o.origemRtCodigo
                      ? `Última atividade: ${o.origemRtCodigo}`
                      : "Localização estimada"}
                    {" — ~"}
                    {o.distanciaEstimadaAtualKm.toFixed(1)} km em linha reta
                    {o.localizacaoAtualizadaEm && ` · ${formatarIdade(o.localizacaoAtualizadaEm)}`}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  {recomendada && o.insercao && (
                    <button
                      type="button"
                      onClick={() =>
                        setEscolha({
                          equipeId: o.equipeId,
                          equipeNome: o.equipeNome,
                          rotaId: o.rotaId,
                          opcaoLabel: "insercao_rota",
                          impactoKm: o.insercao!.distanciaKm,
                          impactoMin: o.insercao!.duracaoMin,
                          tecnicoSugeridoId: o.tecnicoId,
                        })
                      }
                      className={`rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent ${FOCUS_RING}`}
                    >
                      Inserir no meio da rota — {formatarDistancia(o.insercao.distanciaKm, o.insercao.duracaoMin)}
                    </button>
                  )}
                  {recomendada ? (
                    <button
                      type="button"
                      onClick={() =>
                        setEscolha({
                          equipeId: o.equipeId,
                          equipeNome: o.equipeNome,
                          rotaId: o.rotaId,
                          opcaoLabel: "fim_de_rota",
                          impactoKm: o.fimDeRota.distanciaKm,
                          impactoMin: o.fimDeRota.duracaoMin,
                          tecnicoSugeridoId: o.tecnicoId,
                        })
                      }
                      className={`rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent ${FOCUS_RING}`}
                    >
                      Atender ao final da rota — {formatarDistancia(o.fimDeRota.distanciaKm, o.fimDeRota.duracaoMin)}
                    </button>
                  ) : null}
                  {recomendada && o.otimizada && (
                    <button
                      type="button"
                      onClick={() =>
                        setEscolha({
                          equipeId: o.equipeId,
                          equipeNome: o.equipeNome,
                          rotaId: o.rotaId,
                          opcaoLabel: "otimizado",
                          impactoKm: o.otimizada!.impacto.distanciaKm,
                          impactoMin: o.otimizada!.impacto.duracaoMin,
                          tecnicoSugeridoId: o.tecnicoId,
                        })
                      }
                      className={`rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent ${FOCUS_RING}`}
                    >
                      Otimizar para a rota atual — melhor encaixe{" "}
                      {o.otimizada.aposCodigo === null
                        ? `a partir de onde o técnico está agora, antes de ${o.otimizada.antesCodigo}`
                        : o.otimizada.antesCodigo
                          ? `entre ${o.otimizada.aposCodigo} e ${o.otimizada.antesCodigo}`
                          : `depois de ${o.otimizada.aposCodigo}`}{" "}
                      — {formatarDistancia(o.otimizada.impacto.distanciaKm, o.otimizada.impacto.duracaoMin)}
                    </button>
                  )}
                  {!recomendada && (
                    <button
                      type="button"
                      onClick={() =>
                        setEscolha({
                          equipeId: o.equipeId,
                          equipeNome: o.equipeNome,
                          rotaId: o.rotaId,
                          opcaoLabel: "outra_equipe",
                          impactoKm: menor,
                          impactoMin: o.insercao && o.insercao.distanciaKm === menor ? o.insercao.duracaoMin : o.fimDeRota.duracaoMin,
                          tecnicoSugeridoId: o.tecnicoId,
                        })
                      }
                      className={`rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent hover:text-accent ${FOCUS_RING}`}
                    >
                      Selecionar esta equipe — {formatarDistancia(menor, null)}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {escolha && (
        <ConfirmarDespacho
          urgenciaId={urgenciaId}
          escolha={escolha}
          tecnicos={tecnicos.filter((t) => t.ativo && t.equipeId === escolha.equipeId)}
          onCancelar={() => setEscolha(null)}
        />
      )}

      <AtendimentoAvulso urgenciaId={urgenciaId} equipes={equipes} tecnicos={tecnicos} />
    </div>
  );
}

function ConfirmarDespacho({
  urgenciaId,
  escolha,
  tecnicos,
  onCancelar,
}: {
  urgenciaId: string;
  escolha: Escolha;
  tecnicos: Tecnico[];
  onCancelar: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(decidirAtendimento, { error: null });
  const [tecnicoId, setTecnicoId] = useState(escolha.tecnicoSugeridoId ?? "");
  const idTecnico = useId();

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-accent bg-accent/5 p-3">
      <input type="hidden" name="urgenciaId" value={urgenciaId} />
      <input type="hidden" name="opcao" value={escolha.opcaoLabel} />
      <input type="hidden" name="rotaId" value={escolha.rotaId ?? ""} />
      <input type="hidden" name="equipeId" value={escolha.equipeId} />
      <input type="hidden" name="tecnicoId" value={tecnicoId} />
      <input type="hidden" name="impactoKm" value={escolha.impactoKm ?? ""} />
      <input type="hidden" name="impactoMin" value={escolha.impactoMin ?? ""} />

      <p className="text-sm text-text-primary">
        Despachar pra <span className="font-semibold">{escolha.equipeNome}</span>
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor={idTecnico} className={FIELD_LABEL}>
          Técnico responsável
        </label>
        <select
          id={idTecnico}
          value={tecnicoId}
          onChange={(e) => setTecnicoId(e.target.value)}
          required
          className={FIELD_INPUT}
        >
          <option value="" disabled>
            Selecione...
          </option>
          {tecnicos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        {tecnicos.length === 0 && (
          <p className="text-xs text-text-tertiary">Nenhum técnico ativo vinculado a essa equipe.</p>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancelar}
          disabled={isPending}
          className={`text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING}`}
        >
          Voltar
        </button>
        <button
          type="submit"
          disabled={isPending || !tecnicoId}
          className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {isPending ? "Despachando..." : "Despachar técnico"}
        </button>
      </div>
    </form>
  );
}

// Fallback explícito (item 14 do plano de arquitetura original, preservado):
// equipe sem rota confirmada hoje, ou o gerente prefere abrir uma rota nova
// só pra essa urgência. Sem posição de referência (não tem rota hoje), então
// sem distância calculada — escolha 100% manual, de propósito.
function AtendimentoAvulso({
  urgenciaId,
  equipes,
  tecnicos,
}: {
  urgenciaId: string;
  equipes: Equipe[];
  tecnicos: Tecnico[];
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(decidirAtendimento, { error: null });
  const [equipeId, setEquipeId] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const uid = useId();

  const tecnicosDaEquipe = useMemo(
    () => tecnicos.filter((t) => t.ativo && t.equipeId === equipeId),
    [tecnicos, equipeId],
  );

  return (
    <details className="rounded-[var(--radius-sm)] border border-border p-3">
      <summary className="cursor-pointer text-sm font-medium text-text-secondary">
        Atendimento avulso (equipe sem rota hoje)
      </summary>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="urgenciaId" value={urgenciaId} />
        <input type="hidden" name="opcao" value="avulsa" />
        <input type="hidden" name="equipeId" value={equipeId} />
        <input type="hidden" name="tecnicoId" value={tecnicoId} />

        <div className="flex flex-col gap-1">
          <label htmlFor={`${uid}-equipe`} className={FIELD_LABEL}>
            Equipe
          </label>
          <select
            id={`${uid}-equipe`}
            value={equipeId}
            onChange={(e) => {
              setEquipeId(e.target.value);
              setTecnicoId("");
            }}
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
          <label htmlFor={`${uid}-tecnico`} className={FIELD_LABEL}>
            Técnico
          </label>
          <select
            id={`${uid}-tecnico`}
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
            disabled={!equipeId}
            required
            className={FIELD_INPUT}
          >
            <option value="" disabled>
              {equipeId ? "Selecione..." : "Escolha a equipe primeiro"}
            </option>
            {tecnicosDaEquipe.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || !equipeId || !tecnicoId}
            className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            {isPending ? "Despachando..." : "Abrir rota avulsa e despachar"}
          </button>
        </div>
      </form>
    </details>
  );
}
