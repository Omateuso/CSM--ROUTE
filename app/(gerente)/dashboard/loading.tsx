import {
  EsqueletoBloco,
  EsqueletoCards,
  EsqueletoTabela,
  PaginaCarregando,
  TituloSecao,
} from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      secao="Visão geral"
      titulo="Dashboard"
      descricao="Panorama dos chamados em aberto e da execução em campo de hoje."
    >
      {/* Hero "Atenção agora" — o card real troca de tratamento conforme o
          número (AtencaoAgoraCard animado quando > 0, neutro quando 0), mas
          a caixa tem o mesmo tamanho nos dois casos. */}
      <div className="rounded-[var(--radius-md)] border border-border bg-surface p-6">
        <EsqueletoBloco className="h-2.5 w-28" />
        <EsqueletoBloco className="mt-3 h-9 w-20" />
        <EsqueletoBloco className="mt-3 h-3 w-64" />
      </div>

      <section className="mt-10">
        <TituloSecao>Operação de hoje</TituloSecao>
        <p className="mt-1 text-xs text-text-tertiary">
          Serviços das rotas confirmadas pra hoje, por status.
        </p>
        <EsqueletoCards className="mt-4" quantidade={4} />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <TituloSecao>Por região, hoje</TituloSecao>
          <EsqueletoTabela className="mt-3" linhas={4} colunas={4} />
        </div>
        <div>
          <TituloSecao>Por técnico, hoje</TituloSecao>
          <EsqueletoTabela className="mt-3" linhas={4} colunas={4} />
        </div>
      </section>

      <section className="mt-10">
        <TituloSecao>RTs com maior volume</TituloSecao>
        <EsqueletoTabela className="mt-3" linhas={6} colunas={2} />
      </section>
    </PaginaCarregando>
  );
}
