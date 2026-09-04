"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "./modal";
import { FOCUS_RING } from "./styles";

// Componente único pro padrão "resumo (top N) + Ver todos → modal"
// (auditoria de design, 23/08/2026) — existia em 2 lugares com
// comportamento divergente: Painel da gestão cortava em 6 sempre com
// modal; Dashboard do gerente ("RTs com maior volume") cortava em 8 sem
// nenhum jeito de ver o resto — corte silencioso. Este componente não é
// dono da renderização da lista/tabela (cada consumidor continua livre
// pra usar `<table>` ou `<ul>`, como já faziam) — só é dono da regra de
// corte, do botão "Ver todas" e do casco do modal, garantindo que os dois
// nunca mais divirjam.
export function ResumoComModal<T>({
  rotulo,
  itens,
  limite = 6,
  renderLista,
}: {
  /** Nome no plural usado no botão/título, ex. "regiões", "RTs". */
  rotulo: string;
  itens: T[];
  limite?: number;
  renderLista: (itens: T[]) => ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const resumo = itens.slice(0, limite);
  const temMais = itens.length > limite;

  return (
    <>
      {renderLista(resumo)}

      {temMais && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className={`mt-3 text-xs font-medium text-accent transition-colors hover:text-accent-hover ${FOCUS_RING}`}
        >
          Ver todas as {itens.length} {rotulo} →
        </button>
      )}

      <Modal open={aberto} title={`Todas as ${rotulo}`} onClose={() => setAberto(false)}>
        <div className="max-h-[70vh] overflow-y-auto">{renderLista(itens)}</div>
        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setAberto(false)}
            className={`text-sm font-medium text-text-tertiary transition-colors hover:text-text-primary ${FOCUS_RING}`}
          >
            Fechar
          </button>
        </div>
      </Modal>
    </>
  );
}
