import { EsqueletoBloco, EsqueletoLista, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      largura="max-w-3xl"
      secao="Relatórios · perfil gerente"
      titulo="Relatório de RT"
      descricao="Documenta uma ocorrência identificada numa residência terapêutica e gera um documento técnico para encaminhamento ao IGEDES — não é um chamado."
    >
      <EsqueletoBloco className="h-9 w-full" />
      <EsqueletoLista className="mt-6" quantidade={5} />
    </PaginaCarregando>
  );
}
