import { EsqueletoBloco, EsqueletoLista, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      fluida
      largura="max-w-6xl"
      secao="Rotas"
      titulo="Montar rota"
      descricao="Escolha as RTs da rota de hoje. A cada escolha, o sistema sugere as melhores próximas opções — a decisão final é sempre sua."
    >
      {/* Filtro de região + busca + botão de proximidade */}
      <div className="flex flex-wrap items-center gap-3">
        <EsqueletoBloco className="h-9 w-48" />
        <EsqueletoBloco className="h-9 w-full max-w-xs" />
        <EsqueletoBloco className="h-9 w-56" />
      </div>
      <EsqueletoBloco className="mt-4 h-[320px] w-full rounded-[var(--radius-md)]" />
      {/* Lista de candidatas — é ela que a sugestão do servidor preenche */}
      <EsqueletoLista className="mt-6" quantidade={3} />
    </PaginaCarregando>
  );
}
