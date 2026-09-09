import { EsqueletoCards, EsqueletoLista, PaginaCarregando, TituloSecao } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      secao="Execução"
      titulo="Validação"
      uppercase
      descricao="Confira o que o técnico concluiu e feche o ciclo, ou reagende o que ficou parado numa rota que já passou."
    >
      <EsqueletoCards quantidade={3} colunas="sm:grid-cols-3" />

      <section className="mt-10">
        <TituloSecao>Validados recentemente</TituloSecao>
        <EsqueletoLista className="mt-3" quantidade={2} />
      </section>

      <section className="mt-10">
        <TituloSecao>Aguardando validação</TituloSecao>
        <EsqueletoLista className="mt-3" quantidade={3} />
      </section>

      <section className="mt-10">
        <TituloSecao>Travados em rota já passada</TituloSecao>
        <EsqueletoLista className="mt-3" quantidade={3} />
      </section>
    </PaginaCarregando>
  );
}
