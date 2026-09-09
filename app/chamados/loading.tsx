import { EsqueletoBloco, EsqueletoTabela, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      largura="max-w-6xl"
      larguraTexto="max-w-xl"
      secao="Cadastro"
      titulo="Chamados"
      descricao="Espelho dos chamados do TomTicket, com prioridade, SLA e RT vinculada. Sincronizar traz os chamados novos e atualiza o status dos que já estão aqui."
    >
      {/* Barra de busca + filtros do ChamadosManager */}
      <div className="flex flex-wrap items-center gap-3">
        <EsqueletoBloco className="h-9 w-full max-w-sm" />
        <EsqueletoBloco className="h-9 w-36" />
        <EsqueletoBloco className="h-9 w-36" />
      </div>
      <EsqueletoTabela className="mt-4" linhas={10} colunas={5} />
    </PaginaCarregando>
  );
}
