import Link from "next/link";
import { EsqueletoBloco } from "@/lib/ui/skeleton";
import { FOCUS_RING } from "@/lib/ui/styles";

// Detalhe da RT não usa o cabeçalho padrão (seção/título/descrição): o título
// É o código da RT, que vem da consulta. Então aqui só o link de voltar vai
// real — é fixo, e permite sair da tela sem esperar o carregamento.
//
// Alturas = caixa de linha do texto que cada bloco substitui (text-2xl = h-8,
// text-lg = h-7, text-sm = h-5, text-xs = h-4), pra nada pular quando chegar.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-6 sm:py-10" role="status">
      <span className="sr-only">Carregando a RT…</span>
      <Link
        href="/rts"
        className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
      >
        ← RTs
      </Link>

      <header className="mt-4 flex flex-wrap items-baseline gap-3 border-b border-border pb-4">
        <EsqueletoBloco className="h-8 w-28" />
        <EsqueletoBloco className="h-7 w-56" />
        <EsqueletoBloco className="h-5 w-16" />
      </header>

      {/* Grade de dados (CAPS, região, bairro...) */}
      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i}>
            <EsqueletoBloco className="h-4 w-16" />
            <EsqueletoBloco className="mt-1 h-5 w-24" />
          </div>
        ))}
      </dl>

      <section className="mt-8">
        <p className="text-xs font-medium text-text-secondary">
          Endereço atual
        </p>
        <div className="mt-2 rounded-[var(--radius-md)] border border-border-strong bg-surface p-4">
          <EsqueletoBloco className="h-6 w-3/4" />
          <EsqueletoBloco className="mt-2 h-5 w-1/2" />
        </div>
      </section>

      <section className="mt-8">
        <p className="text-xs font-medium text-text-secondary">
          Histórico de endereços
        </p>
        <div className="mt-2 flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="rounded-[var(--radius-md)] bg-surface shadow-lift p-4">
              <EsqueletoBloco className="h-5 w-2/3" />
              <EsqueletoBloco className="mt-2 h-4 w-2/5" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
