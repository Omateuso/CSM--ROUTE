import { EsqueletoLista, PaginaCarregando } from "@/lib/ui/skeleton";

export default function Loading() {
  return (
    <PaginaCarregando
      largura="max-w-2xl"
      margemHeader="mb-8"
      secao="Cadastro"
      titulo="Zonas e regiões"
      descricao="Base territorial usada por RTs, rotas e filtros. Cada zona agrupa uma ou mais regiões — ex.: Zona Oeste contém Campo Grande, Santa Cruz e Bangu."
    >
      {/* Os cards de zona nascem recolhidos (25/08/2026), então o esqueleto
          são 4 caixas curtas, não listas longas de região. */}
      <EsqueletoLista quantidade={4} />
    </PaginaCarregando>
  );
}
