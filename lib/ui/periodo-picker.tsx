"use client";

// Não existia range picker nenhum no projeto (só <input type=date> único em
// rotas-confirmadas-manager.tsx e um <select> de data única em
// relatorio-manager.tsx) — componente novo, só pra isso.
export type PeriodoValor = { inicio: string; fim: string };

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function subtrairDias(dataISO: string, dias: number): string {
  const data = new Date(`${dataISO}T00:00:00`);
  data.setDate(data.getDate() - dias);
  return data.toISOString().slice(0, 10);
}

function primeiroDiaDoMes(dataISO: string): string {
  const data = new Date(`${dataISO}T00:00:00`);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-01`;
}

export function PeriodoPicker({
  valor,
  onChange,
  disabled,
}: {
  valor: PeriodoValor;
  onChange: (valor: PeriodoValor) => void;
  disabled?: boolean;
}) {
  const hoje = hojeISO();
  const atalhos: { label: string; periodo: PeriodoValor }[] = [
    { label: "Hoje", periodo: { inicio: hoje, fim: hoje } },
    { label: "Últimos 7 dias", periodo: { inicio: subtrairDias(hoje, 6), fim: hoje } },
    { label: "Este mês", periodo: { inicio: primeiroDiaDoMes(hoje), fim: hoje } },
  ];

  return (
    <div className={disabled ? "pointer-events-none opacity-40" : undefined}>
      <div className="flex flex-wrap gap-1.5">
        {atalhos.map((atalho) => {
          const ativo = valor.inicio === atalho.periodo.inicio && valor.fim === atalho.periodo.fim;
          return (
            <button
              key={atalho.label}
              type="button"
              onClick={() => onChange(atalho.periodo)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                ativo
                  ? "border-accent bg-accent text-on-accent"
                  : "border-border bg-surface text-text-secondary hover:bg-surface-input"
              }`}
            >
              {atalho.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
        <label className="flex items-center gap-1.5">
          De
          <input
            type="date"
            value={valor.inicio}
            max={valor.fim}
            onChange={(event) => onChange({ ...valor, inicio: event.target.value })}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-2 py-1 text-sm text-text-primary"
          />
        </label>
        <label className="flex items-center gap-1.5">
          até
          <input
            type="date"
            value={valor.fim}
            min={valor.inicio}
            onChange={(event) => onChange({ ...valor, fim: event.target.value })}
            className="rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-2 py-1 text-sm text-text-primary"
          />
        </label>
      </div>
    </div>
  );
}
