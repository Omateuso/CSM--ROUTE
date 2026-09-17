import { EsqueletoBloco, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      largura="max-w-3xl"
      secao="Relatórios · perfil gerente"
      titulo="Novo relatório de RT"
      descricao="Documenta uma ocorrência identificada na RT — não é um chamado."
    >
      <EsqueletoBloco className="h-24 w-full" />
      <EsqueletoBloco className="mt-4 h-9 w-full" />
      <EsqueletoBloco className="mt-4 h-40 w-full" />
      <div className="mt-4 flex gap-3">
        <EsqueletoBloco className="h-24 w-24" />
        <EsqueletoBloco className="h-24 w-24" />
        <EsqueletoBloco className="h-24 w-24" />
      </div>
    </PaginaCarregando>
  );
}
