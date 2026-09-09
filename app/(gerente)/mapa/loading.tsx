import { EsqueletoBloco, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      fluida
      largura="max-w-6xl"
      secao="Visão geral"
      titulo="Mapa operacional"
      descricao="RTs plotadas por localização real, coloridas pelo nível de atenção dos chamados em aberto. Clique numa RT pra ver o detalhe."
    >
      {/* O mapa ocupa a altura restante — o bloco precisa fazer o mesmo,
          senão a página encolhe e volta a crescer quando ele monta. */}
      <EsqueletoBloco className="h-full min-h-[420px] w-full rounded-[var(--radius-md)]" />
    </PaginaCarregando>
  );
}
