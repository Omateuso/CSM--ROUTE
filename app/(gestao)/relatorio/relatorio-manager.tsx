"use client";

import { useMemo, useState } from "react";

export type LinhaRelatorio = {
  data: string;
  regiaoId: string;
  regiaoNome: string;
  totalDoDia: number;
  naoIniciados: number;
  emExecucao: number;
  concluidos: number;
};

const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export function RelatorioManager({ linhas }: { linhas: LinhaRelatorio[] }) {
  const datasDisponiveis = useMemo(() => [...new Set(linhas.map((l) => l.data))], [linhas]);
  const [dataSelecionada, setDataSelecionada] = useState(datasDisponiveis[0] ?? "");

  const linhasDoDia = useMemo(
    () => linhas.filter((l) => l.data === dataSelecionada).sort((a, b) => a.regiaoNome.localeCompare(b.regiaoNome)),
    [linhas, dataSelecionada],
  );

  const totais = linhasDoDia.reduce(
    (acc, l) => ({
      totalDoDia: acc.totalDoDia + l.totalDoDia,
      naoIniciados: acc.naoIniciados + l.naoIniciados,
      emExecucao: acc.emExecucao + l.emExecucao,
      concluidos: acc.concluidos + l.concluidos,
    }),
    { totalDoDia: 0, naoIniciados: 0, emExecucao: 0, concluidos: 0 },
  );

  if (datasDisponiveis.length === 0) {
    return (
      <p className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-10 text-center text-sm text-text-tertiary">
        Nenhuma rota confirmada ainda — o relatório aparece assim que a primeira rota do dia for confirmada.
      </p>
    );
  }

  return (
    <div>
      <label className="sr-only" htmlFor="relatorio-data">
        Data do relatório
      </label>
      <select
        id="relatorio-data"
        value={dataSelecionada}
        onChange={(e) => setDataSelecionada(e.target.value)}
        className="rounded-[var(--radius-sm)] border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent"
      >
        {datasDisponiveis.map((d) => (
          <option key={d} value={d}>
            {formatoData.format(new Date(`${d}T00:00:00`))}
          </option>
        ))}
      </select>

      <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-text-tertiary">
              <th scope="col" className="px-4 py-2.5 font-medium">Região</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Total do dia</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Não iniciados</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Em execução</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Concluídos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {linhasDoDia.map((l) => (
              <tr key={l.regiaoId}>
                <td className="px-4 py-2 text-text-primary">{l.regiaoNome}</td>
                <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{l.totalDoDia}</td>
                <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{l.naoIniciados}</td>
                <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{l.emExecucao}</td>
                <td className="px-3 py-2 text-right tabular-nums text-sla-dentro">{l.concluidos}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-medium">
              <td className="px-4 py-2.5 text-text-primary">Total</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-text-primary">{totais.totalDoDia}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-text-primary">{totais.naoIniciados}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-text-primary">{totais.emExecucao}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-sla-dentro">{totais.concluidos}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
