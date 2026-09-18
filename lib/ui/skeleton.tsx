// Esqueletos de carregamento — o corpo que cada `loading.tsx` mostra
// enquanto a página de verdade é renderizada no servidor.
//
// Por que isso existe (09/09/2026): toda página do sistema é dinâmica
// (lê cookie de sessão), e a doc do Next 16 é explícita — rota dinâmica
// SEM `loading.js` não é pré-carregada de jeito nenhum e ainda bloqueia a
// navegação até a resposta inteira chegar. O resultado é que clicar no
// menu parecia travar a tela antiga por segundos, sem sinal nenhum.
//
// A decisão de design que mais importa aqui: `PaginaCarregando` renderiza
// o cabeçalho DE VERDADE (seção, título e descrição são texto fixo, não
// dependem do banco). O usuário clica em "Validação" e lê "VALIDAÇÃO" no
// mesmo instante — só a parte que depende de consulta vira bloco cinza. É
// o que faz a troca parecer instantânea e, de quebra, elimina o pulo de
// layout quando o dado chega: o cabeçalho já estava no lugar final.
import type { ReactNode } from "react";

// `motion-safe:` em vez de `animate-pulse` puro — mesma consideração de
// prefers-reduced-motion já aplicada no menu, no login e nos cards do
// dashboard. Sem animação o bloco continua visível (é cor, não movimento),
// e o `role="status"` abaixo garante o aviso pra leitor de tela.
const BASE = "rounded-[var(--radius-sm)] bg-skeleton motion-safe:animate-pulse";

export function EsqueletoBloco({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`${BASE} ${className}`} />;
}

// Larguras alternadas: linhas todas do mesmo tamanho leem como uma tabela
// vazia, não como texto carregando.
const LARGURAS = ["w-full", "w-11/12", "w-4/5", "w-9/12"];

export function EsqueletoTexto({
  linhas = 3,
  className = "",
}: {
  linhas?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: linhas }, (_, i) => (
        <EsqueletoBloco key={i} className={`h-3 ${LARGURAS[i % LARGURAS.length]}`} />
      ))}
    </div>
  );
}

// Espelha StatCard/OperacaoHojeCard: mesma borda, mesmo raio, mesmo
// padding — o card não "nasce" na tela quando o número chega, só troca o
// bloco cinza pelo valor.
export function EsqueletoCards({
  quantidade = 4,
  colunas = "sm:grid-cols-4",
  className = "",
}: {
  quantidade?: number;
  colunas?: string;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-2 gap-4 ${colunas} ${className}`}>
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className="rounded-[var(--radius-md)] bg-surface shadow-lift p-5">
          <EsqueletoBloco className="h-2.5 w-2/3" />
          <EsqueletoBloco className="mt-3 h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

export function EsqueletoTabela({
  linhas = 6,
  colunas = 4,
  className = "",
}: {
  linhas?: number;
  colunas?: number;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-md)] bg-surface shadow-lift ${className}`}
    >
      <div className="flex gap-4 border-b border-border bg-surface-input px-4 py-3">
        {Array.from({ length: colunas }, (_, i) => (
          <EsqueletoBloco key={i} className="h-2.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex gap-4 border-b border-border px-4 py-3 last:border-b-0">
          {Array.from({ length: colunas }, (_, j) => (
            <EsqueletoBloco key={j} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Listas de cards empilhados (Validação, Pendências, Urgências, serviços
// do técnico) — o formato mais comum do sistema depois da tabela.
export function EsqueletoLista({
  quantidade = 3,
  className = "",
}: {
  quantidade?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className="rounded-[var(--radius-md)] bg-surface shadow-lift p-4">
          <div className="flex items-center justify-between gap-4">
            <EsqueletoBloco className="h-3.5 w-36" />
            <EsqueletoBloco className="h-3 w-20" />
          </div>
          <EsqueletoBloco className="mt-3 h-2.5 w-2/3" />
          <EsqueletoBloco className="mt-2 h-2.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// Título de seção ("Operação de hoje", "Aguardando validação"...) — texto
// fixo também, então vai real, igual ao cabeçalho da página.
export function TituloSecao({ children }: { children: ReactNode }) {
  return <h2 className="text-sm font-semibold text-text-primary">{children}</h2>;
}

type CabecalhoProps = {
  secao: string;
  titulo: string;
  descricao: ReactNode;
  larguraTexto?: string;
};

function Cabecalho({ secao, titulo, descricao, larguraTexto = "" }: CabecalhoProps) {
  return (
    <div className={larguraTexto}>
      <p className="text-xs font-medium text-text-tertiary">{secao}</p>
      <h1 className="mt-1 text-2xl font-semibold text-text-primary">{titulo}</h1>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{descricao}</p>
    </div>
  );
}

export function PaginaCarregando({
  largura = "max-w-5xl",
  margemHeader = "mb-6",
  fluida = false,
  children,
  ...cabecalho
}: CabecalhoProps & {
  /** Precisa bater com o `max-w-*` da página real, senão o conteúdo salta de largura ao chegar. */
  largura?: string;
  /** Zonas usa `mb-8`; o resto do sistema, `mb-6`. */
  margemHeader?: string;
  /** Mapa e Montar rota não usam o wrapper padrão: o conteúdo ocupa a altura restante (`flex-1`). */
  fluida?: boolean;
  children: ReactNode;
}) {
  // O cabeçalho acima já foi lido pelo leitor de tela; `role="status"` avisa
  // que o resto ainda está a caminho, sem repetir o título.
  const corpo = (
    <>
      <span className="sr-only">Carregando conteúdo…</span>
      {children}
    </>
  );

  if (fluida) {
    return (
      <div className="flex flex-1 flex-col">
        <header className={`mx-auto w-full ${largura} px-4 pt-7 pb-5 sm:px-6 sm:pt-10 sm:pb-6`}>
          <Cabecalho {...cabecalho} />
        </header>
        <div className={`mx-auto w-full ${largura} flex-1 px-4 pb-8 sm:px-6 sm:pb-10`} role="status">
          {corpo}
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto w-full ${largura} px-4 py-7 sm:px-6 sm:py-10`}>
      <header className={margemHeader}>
        <Cabecalho {...cabecalho} />
      </header>
      <div role="status">{corpo}</div>
    </div>
  );
}
