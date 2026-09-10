import { EsqueletoBloco, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      largura="max-w-6xl"
      secao="Operação"
      titulo="Rota do dia"
      descricao={
        <>
          As rotas confirmadas de hoje no mapa — cada parada muda de cor conforme a equipe avança, e o
          atendimento em andamento aparece assim que o técnico inicia.{" "}
          <span className="inline-flex items-center gap-1 align-middle text-xs text-sla-dentro">
            <span aria-hidden="true">●</span> ao vivo
          </span>
        </>
      }
    >
      {/* Linha de resumo ("... concluídas") acima do mapa */}
      <EsqueletoBloco className="h-4 w-64" />
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Mesma altura fixa do mapa real — sem isso a página encolhe e volta
            a crescer quando ele monta. */}
        <EsqueletoBloco className="h-[420px] w-full rounded-[var(--radius-md)] lg:h-[600px]" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
              <EsqueletoBloco className="h-4 w-32" />
              <EsqueletoBloco className="mt-3 h-3 w-full" />
              <EsqueletoBloco className="mt-2 h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </PaginaCarregando>
  );
}
