import { EsqueletoLista, PaginaCarregando, TituloSecao } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      secao="Execução"
      titulo="Central de urgências"
      descricao="Ocorrências excepcionais recebidas fora do ciclo normal de rota — o sistema observa e calcula, quem decide é sempre o gerente."
    >
      <section>
        <TituloSecao>Solicitadas</TituloSecao>
        <EsqueletoLista className="mt-3" quantidade={2} />
      </section>
      <section className="mt-10">
        <TituloSecao>Em análise</TituloSecao>
        <EsqueletoLista className="mt-3" quantidade={2} />
      </section>
      <section className="mt-10">
        <TituloSecao>Em atendimento</TituloSecao>
        <EsqueletoLista className="mt-3" quantidade={2} />
      </section>
    </PaginaCarregando>
  );
}
