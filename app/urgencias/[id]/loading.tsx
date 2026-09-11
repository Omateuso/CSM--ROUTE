import Link from "next/link";
import { EsqueletoBloco } from "@/lib/ui/skeleton";
import { FOCUS_RING } from "@/lib/ui/styles";

// Detalhe da urgência não usa o cabeçalho padrão (o título é o assunto do
// chamado, que vem da consulta) — mesma situação de app/(gestao)/rts/[id],
// só o link de voltar vai real.
//
// Alturas = caixa de linha do texto que cada bloco substitui (text-2xl =
// h-8, text-sm = h-5, text-xs = h-4), pra nada pular quando o dado chegar.
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12" role="status">
      <span className="sr-only">Carregando a urgência…</span>
      <Link href="/urgencias" className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
        ← Central de urgências
      </Link>

      <header className="mt-4 mb-6">
        <EsqueletoBloco className="h-4 w-24" />
        <EsqueletoBloco className="mt-2 h-8 w-96" />
        <EsqueletoBloco className="mt-2 h-5 w-64" />
      </header>

      <div className="flex flex-col gap-4">
        <EsqueletoBloco className="h-40" />
        <EsqueletoBloco className="h-32" />
        <EsqueletoBloco className="h-24" />
      </div>
    </div>
  );
}
