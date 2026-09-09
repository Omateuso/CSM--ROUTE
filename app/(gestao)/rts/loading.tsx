import { EsqueletoBloco, EsqueletoTabela, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      secao="Cadastro"
      titulo="RTs"
      descricao="Residências Terapêuticas atendidas — endereço, localização, CAPS responsável e bairro de cada uma. Base usada pelo mapa, pelas rotas e pelos chamados."
    >
      <div className="flex flex-wrap items-center gap-3">
        <EsqueletoBloco className="h-9 w-full max-w-sm" />
        <EsqueletoBloco className="h-9 w-32" />
      </div>
      <EsqueletoTabela className="mt-4" linhas={10} colunas={4} />
    </PaginaCarregando>
  );
}
