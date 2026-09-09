import { EsqueletoBloco, EsqueletoTabela, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      secao="Rotas"
      titulo="Rotas confirmadas"
      descricao="Histórico de rotas do dia já confirmadas — registro fixo, não editável por aqui."
    >
      {/* Filtros por data / região / equipe */}
      <div className="flex flex-wrap items-center gap-3">
        <EsqueletoBloco className="h-9 w-40" />
        <EsqueletoBloco className="h-9 w-40" />
        <EsqueletoBloco className="h-9 w-40" />
      </div>
      <EsqueletoTabela className="mt-4" linhas={8} colunas={5} />
    </PaginaCarregando>
  );
}
