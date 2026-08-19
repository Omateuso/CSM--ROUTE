"use client";

import { useState } from "react";
import { Modal } from "@/lib/ui/modal";
import { FOCUS_RING } from "@/lib/ui/styles";

export type RegiaoLinha = { nome: string; total: number; vencido: number };

const LIMITE_INLINE = 6;

function TabelaRegioes({ regioes }: { regioes: RegiaoLinha[] }) {
  return (
    <table className="w-full min-w-[340px] border-collapse text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs font-medium text-text-tertiary">
          <th scope="col" className="px-4 py-[3.5px] font-medium">Região</th>
          <th scope="col" className="px-3 py-[3.5px] text-right font-medium">Abertos</th>
          <th scope="col" className="px-3 py-[3.5px] text-right font-medium">SLA vencido</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {regioes.length === 0 ? (
          <tr>
            <td colSpan={3} className="px-4 py-6 text-center text-xs text-text-tertiary">
              Nenhum chamado em aberto.
            </td>
          </tr>
        ) : (
          regioes.map((r) => (
            <tr key={r.nome}>
              <td className="px-4 py-2 text-text-primary">{r.nome}</td>
              <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{r.total}</td>
              <td className="px-3 py-2 text-right tabular-nums text-sla-vencido">{r.vencido}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

// "Por região" cobre até ~36 linhas (uma por região real do projeto) — a
// tabela inteira inline obrigava rolar a página toda pra ver o resto do
// painel. Mostra só as top 6 (já vêm ordenadas por volume) e um botão pra
// ver a lista completa num modal, sem competir pelo espaço da página.
export function RegiaoSection({ regioes }: { regioes: RegiaoLinha[] }) {
  const [aberto, setAberto] = useState(false);
  const inline = regioes.slice(0, LIMITE_INLINE);

  return (
    <div>
      <h2 className="text-sm font-semibold text-text-primary">Por região</h2>
      <p className="mt-1 text-xs text-text-tertiary">Chamados em aberto e SLA vencido, por região.</p>
      <div className="mt-3 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
        <TabelaRegioes regioes={inline} />
      </div>

      {regioes.length > LIMITE_INLINE && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className={`mt-2 text-xs font-medium text-accent transition-colors hover:text-accent-hover ${FOCUS_RING}`}
        >
          Ver todas as {regioes.length} regiões →
        </button>
      )}

      <Modal open={aberto} title="Chamados por região" onClose={() => setAberto(false)}>
        <div className="max-h-[70vh] overflow-y-auto">
          <TabelaRegioes regioes={regioes} />
        </div>
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
    </div>
  );
}
