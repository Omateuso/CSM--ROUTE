import { EsqueletoBloco, EsqueletoTabela, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      largura="max-w-4xl"
      secao="Visão geral"
      titulo="Relatório diário"
      descricao="Operação do dia por região, a partir das rotas confirmadas."
    >
      {/* Seletor de data (só datas com rota confirmada) */}
      <EsqueletoBloco className="h-9 w-56" />
      <EsqueletoTabela className="mt-4" linhas={8} colunas={5} />
    </PaginaCarregando>
  );
}
