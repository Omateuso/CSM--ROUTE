import { EsqueletoLista, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      secao="Execução"
      titulo="Pendências"
      uppercase
      descricao="Atendimento iniciado, mas não concluído — some sozinha daqui assim que o chamado entrar numa rota nova."
    >
      <EsqueletoLista quantidade={4} />
    </PaginaCarregando>
  );
}
