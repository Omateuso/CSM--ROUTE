"use client";

import { useState } from "react";
import { Modal } from "@/lib/ui/modal";
import { PeriodoPicker, type PeriodoValor } from "@/lib/ui/periodo-picker";
import { BLOCOS_AGORA_DEFS, BLOCOS_PERIODO_DEFS, IDS_PADRAO } from "@/lib/relatorio/metadados";
import type { BlocoId } from "@/lib/relatorio/types";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Ponto de entrada — `page.tsx` (Server Component) só renderiza este botão;
// o estado de "modal aberto" é local aqui, não precisa subir pro server.
export function GerarRelatorioButton() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Gerar relatório
      </button>
      {aberto && <GeradorRelatorioModal onClose={() => setAberto(false)} />}
    </>
  );
}

function GeradorRelatorioModal({ onClose }: { onClose: () => void }) {
  const hoje = hojeISO();
  const [periodo, setPeriodo] = useState<PeriodoValor>({ inicio: hoje, fim: hoje });
  const [selecionados, setSelecionados] = useState<Set<BlocoId>>(new Set(IDS_PADRAO));

  const temBlocoPeriodo = BLOCOS_PERIODO_DEFS.some((b) => selecionados.has(b.id));

  function alternar(id: BlocoId) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function gerar() {
    if (selecionados.size === 0) return;
    const params = new URLSearchParams();
    params.set("blocos", [...selecionados].join(","));
    if (temBlocoPeriodo) {
      params.set("inicio", periodo.inicio);
      params.set("fim", periodo.fim);
    }
    window.open(`/relatorio/gerar?${params.toString()}`, "_blank", "noopener");
    onClose();
  }

  return (
    <Modal open title="Gerar relatório" onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium text-text-secondary">Período</p>
          <PeriodoPicker valor={periodo} onChange={setPeriodo} disabled={!temBlocoPeriodo} />
          {!temBlocoPeriodo && (
            <p className="mt-1.5 text-xs text-text-tertiary">
              Nenhum bloco &ldquo;do período&rdquo; selecionado — o período fica sem efeito.
            </p>
          )}
        </div>

        <GrupoBlocos
          titulo="Agora"
          descricao="Fotografia do estado atual — o período acima não se aplica a esses blocos."
          blocos={BLOCOS_AGORA_DEFS}
          rotulo="(dado atual)"
          selecionados={selecionados}
          onAlternar={alternar}
        />

        <GrupoBlocos
          titulo="No período selecionado"
          descricao="Dependem do período escolhido acima."
          blocos={BLOCOS_PERIODO_DEFS}
          rotulo="(do período)"
          selecionados={selecionados}
          onAlternar={alternar}
        />

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-input"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={gerar}
            disabled={selecionados.size === 0}
            className="rounded-[var(--radius-sm)] bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Gerar relatório
          </button>
        </div>
      </div>
    </Modal>
  );
}

function GrupoBlocos({
  titulo,
  descricao,
  blocos,
  rotulo,
  selecionados,
  onAlternar,
}: {
  titulo: string;
  descricao: string;
  blocos: { id: BlocoId; titulo: string; resumoCurto: string }[];
  rotulo: string;
  selecionados: Set<BlocoId>;
  onAlternar: (id: BlocoId) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-text-secondary">{titulo}</p>
      <p className="mt-0.5 text-xs text-text-tertiary">{descricao}</p>
      <ul className="mt-2 space-y-1.5">
        {blocos.map((bloco) => (
          <li key={bloco.id}>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-input">
              <input
                type="checkbox"
                checked={selecionados.has(bloco.id)}
                onChange={() => onAlternar(bloco.id)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-text-primary">{bloco.titulo}</span>{" "}
                <span className="text-xs text-text-tertiary">{rotulo}</span>
                <br />
                <span className="text-xs text-text-tertiary">{bloco.resumoCurto}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
