import { EsqueletoBloco, EsqueletoLista } from "@/lib/ui/skeleton";

// O técnico não tem menu (decisão de persona: mobile-first, "poucos toques
// por tela"), então o esqueleto precisa carregar o cabeçalho inteiro — não
// existe moldura persistente em volta pra segurar a tela como no gerente.
//
// Diferente das telas de gerente/gestão, aqui o título não é 100% fixo: a
// data e o nome de quem entrou dependem da sessão, então esses dois viram
// bloco. "Meus serviços" é constante e vai real.
//
// As alturas dos blocos são as caixas de linha do texto que eles
// substituem (text-xs = h-4, text-sm = h-5), não valores escolhidos a olho:
// um bloco menor que o texto final empurra o <h1> pra cima e a tela pula
// quando o dado chega — foi exatamente o que a medição pegou aqui (4px).
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col" role="status">
      <span className="sr-only">Carregando seus serviços…</span>
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 pt-8 pb-4">
        <div>
          <EsqueletoBloco className="h-4 w-28" />
          <h1 className="mt-1 text-xl font-semibold text-text-primary">Meus serviços</h1>
          <EsqueletoBloco className="mt-1 h-5 w-32" />
        </div>
        <EsqueletoBloco className="h-8 w-16" />
      </header>

      <div className="flex-1 px-4 py-4">
        {/* Cabeçalho de dia ("Rota dia DD/MM/AAAA") + grupos de RT */}
        <EsqueletoBloco className="mb-2 h-5 w-44" />
        <EsqueletoLista quantidade={3} />
      </div>
    </div>
  );
}
