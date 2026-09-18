"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { programarReexecucao, type ReexecucaoState } from "./actions";
import { Modal } from "@/lib/ui/modal";
import { useCloseOnSuccess } from "@/lib/ui/use-close-on-success";
import { FOCUS_RING, FIELD_INPUT, FIELD_LABEL } from "@/lib/ui/styles";
import { PlacaRt } from "@/lib/ui/placa-rt";

export type RotaParaReexecucao = {
  id: string;
  data: string; // ISO "YYYY-MM-DD"
  equipeId: string;
  equipeNome: string;
  regiaoNome: string;
};
type Tecnico = { id: string; nome: string; equipeId: string | null };

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function ProgramarReexecucao({
  servicoId,
  rtCodigo,
  chamadoAssunto,
  rotas,
  tecnicos,
}: {
  servicoId: string;
  rtCodigo: string;
  chamadoAssunto: string;
  rotas: RotaParaReexecucao[];
  tecnicos: Tecnico[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`shrink-0 rounded-[var(--radius-sm)] border border-accent px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-on-accent ${FOCUS_RING}`}
      >
        Programar nova execução
      </button>
      {aberto && (
        <ReexecucaoDialog
          servicoId={servicoId}
          rtCodigo={rtCodigo}
          chamadoAssunto={chamadoAssunto}
          rotas={rotas}
          tecnicos={tecnicos}
          onClose={() => setAberto(false)}
        />
      )}
    </>
  );
}

function ReexecucaoDialog({
  servicoId,
  rtCodigo,
  chamadoAssunto,
  rotas,
  tecnicos,
  onClose,
}: {
  servicoId: string;
  rtCodigo: string;
  chamadoAssunto: string;
  rotas: RotaParaReexecucao[];
  tecnicos: Tecnico[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ReexecucaoState, FormData>(programarReexecucao, {
    error: null,
  });
  useCloseOnSuccess(isPending, state.error, onClose);

  const uid = useId();
  const idRota = `${uid}-rota`;
  const idTecnico = `${uid}-tecnico`;
  const idObs = `${uid}-obs`;

  const [rotaId, setRotaId] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");

  const rotaEscolhida = rotas.find((r) => r.id === rotaId) ?? null;
  const tecnicosDaRota = useMemo(
    () => (rotaEscolhida ? tecnicos.filter((t) => t.equipeId === rotaEscolhida.equipeId) : []),
    [tecnicos, rotaEscolhida],
  );

  function handleTrocarRota(novo: string) {
    setRotaId(novo);
    setTecnicoId("");
  }

  return (
    <Modal open title="Programar nova execução" onClose={onClose}>
      {rotas.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Não há rota confirmada de hoje em diante pra receber a nova execução. Confirme uma rota primeiro
          em <strong>Montar rota</strong>.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="servicoId" value={servicoId} />
          <input type="hidden" name="rotaId" value={rotaId} />
          <input type="hidden" name="tecnicoId" value={tecnicoId} />

          <p className="text-sm text-text-secondary">
            <PlacaRt codigo={rtCodigo} /> — {chamadoAssunto}
          </p>

          <div className="flex flex-col gap-1">
            <label htmlFor={idRota} className={FIELD_LABEL}>
              Rota que vai receber
            </label>
            <select
              id={idRota}
              value={rotaId}
              onChange={(e) => handleTrocarRota(e.target.value)}
              required
              className={FIELD_INPUT}
            >
              <option value="" disabled>
                Selecione uma rota confirmada...
              </option>
              {rotas.map((r) => (
                <option key={r.id} value={r.id}>
                  {formatoData.format(new Date(`${r.data}T00:00:00`))} · {r.equipeNome} · {r.regiaoNome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={idTecnico} className={FIELD_LABEL}>
              Técnico responsável
            </label>
            <select
              id={idTecnico}
              value={tecnicoId}
              onChange={(e) => setTecnicoId(e.target.value)}
              disabled={!rotaEscolhida}
              required
              className={FIELD_INPUT}
            >
              <option value="" disabled>
                {rotaEscolhida ? "Técnico responsável..." : "Escolha a rota primeiro"}
              </option>
              {tecnicosDaRota.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-tertiary">
              Se essa RT já estiver nessa rota, a nova execução fica com o técnico já escalado nela.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={idObs} className={FIELD_LABEL}>
              Observação <span className="font-normal text-text-tertiary">(opcional)</span>
            </label>
            <textarea
              id={idObs}
              name="observacao"
              rows={2}
              placeholder="Ex.: material já comprado, decisão da gestão saiu..."
              className={`${FIELD_INPUT} resize-y`}
            />
          </div>

          {rotaEscolhida && tecnicosDaRota.length === 0 && (
            <p className="text-xs text-text-tertiary">
              Nenhum técnico ativo vinculado à equipe dessa rota.
            </p>
          )}

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
              disabled={isPending || !rotaId || !tecnicoId}
              className={`rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              {isPending ? "Programando..." : "Programar"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
