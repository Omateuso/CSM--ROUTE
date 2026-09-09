import { EsqueletoLista, EsqueletoTabela, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      secao="Cadastro"
      titulo="Equipes e técnicos"
      descricao="Organize os técnicos em equipes — base pra montar as rotas do dia (Fase 2). Contas de técnico são criadas fora daqui; aqui você só vincula um técnico já existente a uma equipe."
    >
      <EsqueletoLista quantidade={3} />
      <EsqueletoTabela className="mt-10" linhas={5} colunas={3} />
    </PaginaCarregando>
  );
}
