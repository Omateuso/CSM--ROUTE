import Link from "next/link";
import { EsqueletoBloco, EsqueletoTexto } from "@/lib/ui/skeleton";
import { FOCUS_RING } from "@/lib/ui/styles";

// Detalhe do serviço. Tudo que identifica o registro (RT, endereço,
// protocolo, prazo) depende da consulta, então vira bloco — mas o link de
// voltar é fixo e vai REAL de propósito: se o técnico abriu o serviço
// errado, ele consegue voltar sem esperar a tela carregar.
//
// Alturas = caixa de linha do texto que cada bloco substitui (text-xs =
// h-4, text-lg = h-7, text-sm = h-5), pra o conteúdo não pular quando
// chegar.
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col" role="status">
      <span className="sr-only">Carregando o serviço…</span>
      <header className="border-b border-border px-4 pt-6 pb-4">
        <Link
          href="/servicos-do-dia"
          className={`text-xs font-medium text-text-tertiary hover:text-text-primary ${FOCUS_RING}`}
        >
          ← Meus serviços
        </Link>
        {/* Linha de código da RT + protocolo + data + badge de status */}
        <EsqueletoBloco className="mt-2 h-4 w-56" />
        <EsqueletoBloco className="mt-1 h-7 w-52" />
        <EsqueletoBloco className="mt-0.5 h-5 w-64" />
      </header>

      <div className="flex-1 px-4 py-5">
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <EsqueletoBloco className="h-4 w-32" />
          <EsqueletoTexto className="mt-3" linhas={3} />
        </div>
        {/* Ação principal (Iniciar atendimento / formulário de conclusão) */}
        <EsqueletoBloco className="mt-5 h-12 w-full" />
      </div>
    </div>
  );
}
