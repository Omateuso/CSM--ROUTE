import { EsqueletoCards, EsqueletoLista, PaginaCarregando, TituloSecao } from "@/lib/ui/skeleton";

// A ordem das seções aqui precisa acompanhar a de page.tsx — desde a Fase 6
// ela segue a prioridade de AÇÃO (o que exige decisão primeiro, o arquivo de
// "Validados recentemente" por último). Esqueleto fora de ordem reintroduz
// exatamente o pulo de layout que este arquivo existe pra evitar.
export default function Loading() {
  return (
    <PaginaCarregando
      secao="Execução"
      titulo="Validação"
      uppercase
      descricao="Confira o que o técnico concluiu e feche o ciclo, ou reagende o que ficou parado numa rota que já passou."
    >
      <EsqueletoCards quantidade={4} colunas="sm:grid-cols-2 lg:grid-cols-4" />

      <section className="mt-10">
        <TituloSecao>Aguardando validação</TituloSecao>
        <EsqueletoLista className="mt-3" quantidade={3} />
      </section>

      <section className="mt-10">
        <TituloSecao>Apontados pelo técnico</TituloSecao>
        <EsqueletoLista className="mt-3" quantidade={2} />
      </section>

      <section className="mt-10">
        <TituloSecao>Travados em rota já passada</TituloSecao>
        <EsqueletoLista className="mt-3" quantidade={3} />
      </section>

      <section className="mt-10">
        <TituloSecao>Validados recentemente</TituloSecao>
        <EsqueletoLista className="mt-3" quantidade={2} />
      </section>
    </PaginaCarregando>
  );
}
