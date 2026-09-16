import Link from "next/link";
import { EsqueletoBloco } from "@/lib/ui/skeleton";
import { FOCUS_RING } from "@/lib/ui/styles";

// Histórico de uma RT não usa o cabeçalho padrão — o título é o código da
// RT, que vem da consulta. Só o link de voltar vai real (fixo).
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12" role="status">
      <span className="sr-only">Carregando o histórico da RT…</span>
      <Link href="/relatorios/rt" className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
        ← Relatório de RT
      </Link>

      <header className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
        <div>
          <EsqueletoBloco className="h-8 w-28" />
          <EsqueletoBloco className="mt-2 h-4 w-56" />
        </div>
        <EsqueletoBloco className="h-8 w-48" />
      </header>

      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <EsqueletoBloco className="h-3.5 w-2/3" />
            <EsqueletoBloco className="mt-2 h-2.5 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
