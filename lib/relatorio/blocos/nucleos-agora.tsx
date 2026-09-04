import { detectarNucleos, type Nucleo } from "@/lib/routing/clusters";
import { NUCLEO_MIN_RTS } from "@/lib/routing/config";
import { SecaoRelatorio, Tabela, SemDados } from "../componentes-impressao";
import { SecaoRelatorioPdf, TabelaPdf, SemDadosPdf } from "../pdf/componentes-impressao-pdf";
import { DEF_NUCLEOS_AGORA } from "../metadados";
import type { BlocoModulo, SupabaseServerClient } from "../types";

const STATUS_ABERTO = new Set(["aberto", "em_andamento"]);

type LinhaNucleo = { qtdRts: number; totalChamados: number; codigos: string[] };
type Dados = { nucleos: LinhaNucleo[] };

async function buscar(supabase: SupabaseServerClient): Promise<Dados> {
  const [{ data: rtsRaw, error: erroRts }, { data: chamadosRaw, error: erroChamados }] = await Promise.all([
    supabase.from("rts").select("id, codigo, latitude, longitude").eq("ativo", true),
    supabase.from("chamados").select("rt_id, status"),
  ]);
  if (erroRts) throw new Error(erroRts.message);
  if (erroChamados) throw new Error(erroChamados.message);

  const abertosPorRt = new Map<string, number>();
  for (const c of chamadosRaw ?? []) {
    if (!STATUS_ABERTO.has(c.status as string)) continue;
    const chave = c.rt_id as string;
    abertosPorRt.set(chave, (abertosPorRt.get(chave) ?? 0) + 1);
  }

  // Mesma entrada que lib/routing/intelligent-route.ts monta pra sugestão
  // de rota — só que aqui reaproveitada pra "fotografar" os núcleos que
  // existem agora, não pra sugerir uma rota específica.
  const rtsParaNucleo = (rtsRaw ?? []).map((rt) => ({
    id: rt.id as string,
    codigo: rt.codigo as string,
    lat: Number(rt.latitude),
    lng: Number(rt.longitude),
    totalAbertos: abertosPorRt.get(rt.id as string) ?? 0,
  }));

  const codigoPorId = new Map(rtsParaNucleo.map((rt) => [rt.id, rt.codigo]));
  const nucleosBrutos: Nucleo[] = detectarNucleos(rtsParaNucleo);

  const nucleos: LinhaNucleo[] = nucleosBrutos
    .sort((a, b) => b.totalChamados - a.totalChamados)
    .map((n) => ({
      qtdRts: n.rtIds.length,
      totalChamados: n.totalChamados,
      codigos: n.rtIds.map((id) => codigoPorId.get(id) ?? "?"),
    }));

  return { nucleos };
}

function resumoFrase(dados: Dados): string | null {
  if (dados.nucleos.length === 0) return null;
  const maior = dados.nucleos[0];
  return `Foi identificado 1 núcleo operacional com ${maior.qtdRts} RTs muito próximas entre si, totalizando ${maior.totalChamados} chamados em aberto.`;
}

function Secao({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorio
      titulo="Núcleos operacionais identificados agora"
      subtitulo={`RTs muito próximas entre si (≥ ${NUCLEO_MIN_RTS}, ex.: mesmo condomínio) que permitem atendimento em conjunto — dado atual, recalculado sobre a posição das RTs e os chamados abertos agora. É sempre sugestão: quem decide atender em conjunto é o gerente, na tela de Montar Rota.`}
    >
      {dados.nucleos.length === 0 ? (
        <SemDados>Nenhum núcleo operacional identificado no momento.</SemDados>
      ) : (
        <Tabela colunas={["RTs no núcleo", "Chamados em aberto", "Códigos"]}>
          {dados.nucleos.map((n, indice) => (
            <tr key={indice}>
              <td>{n.qtdRts}</td>
              <td>{n.totalChamados}</td>
              <td>{n.codigos.join(", ")}</td>
            </tr>
          ))}
        </Tabela>
      )}
    </SecaoRelatorio>
  );
}

function SecaoPdf({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorioPdf
      titulo="Núcleos operacionais identificados agora"
      // "≥" fora do PDF: a fonte padrão (Helvetica, sem embedding de fonte
      // Unicode) não tem esse glifo — virava "e" errado no PDF gerado
      // (achado revisando o texto extraído do PDF de teste, 27/08/2026).
      // ">=" é ASCII-safe; a versão HTML (Secao) mantém "≥" normalmente,
      // navegador não tem essa limitação.
      subtitulo={`RTs muito próximas entre si (>= ${NUCLEO_MIN_RTS}, ex.: mesmo condomínio) que permitem atendimento em conjunto — dado atual, recalculado sobre a posição das RTs e os chamados abertos agora. É sempre sugestão: quem decide atender em conjunto é o gerente, na tela de Montar Rota.`}
    >
      {dados.nucleos.length === 0 ? (
        <SemDadosPdf>Nenhum núcleo operacional identificado no momento.</SemDadosPdf>
      ) : (
        <TabelaPdf
          colunas={["RTs no núcleo", "Chamados em aberto", "Códigos"]}
          linhas={dados.nucleos.map((n) => [n.qtdRts, n.totalChamados, n.codigos.join(", ")])}
        />
      )}
    </SecaoRelatorioPdf>
  );
}

export const nucleosAgora: BlocoModulo<Dados> = {
  definicao: DEF_NUCLEOS_AGORA,
  buscar,
  resumoFrase,
  Secao,
  SecaoPdf,
};
