import { EsqueletoBloco, EsqueletoCards, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      largura="max-w-3xl"
      secao="Exportação · perfil gerente"
      titulo="Relatório mensal CSM"
      descricao={
        <>
          Gera o pacote entregue ao IGEDES: a planilha <strong>ANEXO 1</strong> (.xlsx) e o documento
          com uma página por serviço (.docx), a partir dos serviços <strong>validados</strong> no mês.
          Substitui a montagem manual da planilha + PowerPoint.
        </>
      }
    >
      {/* Filtros (mês, CAPS/região, nota fiscal) */}
      <div className="flex flex-wrap items-center gap-3">
        <EsqueletoBloco className="h-9 w-44" />
        <EsqueletoBloco className="h-9 w-44" />
        <EsqueletoBloco className="h-9 w-36" />
      </div>
      {/* Prévia — 3 cards de contagem */}
      <EsqueletoCards className="mt-6" quantidade={3} colunas="sm:grid-cols-3" />
      <div className="mt-6 flex flex-wrap gap-3">
        <EsqueletoBloco className="h-10 w-40" />
        <EsqueletoBloco className="h-10 w-40" />
      </div>
    </PaginaCarregando>
  );
}
