import { EsqueletoCards, EsqueletoTabela, PaginaCarregando, TituloSecao } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      secao="Visão geral"
      titulo="Painel da gestão"
      descricao="Panorama consolidado, só leitura — chamados, execução e rotas."
    >
      <EsqueletoCards quantidade={3} colunas="sm:grid-cols-3" />

      <section className="mt-10">
        <TituloSecao>Serviços em execução</TituloSecao>
        <EsqueletoCards className="mt-4" quantidade={5} colunas="sm:grid-cols-5" />
      </section>

      <section className="mt-10">
        <TituloSecao>Rotas confirmadas recentes</TituloSecao>
        <EsqueletoTabela className="mt-3" linhas={6} colunas={4} />
      </section>

      <section className="mt-10">
        <TituloSecao>Por criticidade</TituloSecao>
        <EsqueletoCards className="mt-4" quantidade={4} />
      </section>

      <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <EsqueletoTabela linhas={6} colunas={3} />
        <EsqueletoTabela linhas={6} colunas={3} />
      </section>
    </PaginaCarregando>
  );
}
