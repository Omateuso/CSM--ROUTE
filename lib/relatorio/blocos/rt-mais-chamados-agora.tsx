import { SecaoRelatorio, Tabela, SemDados } from "../componentes-impressao";
import { SecaoRelatorioPdf, TabelaPdf, SemDadosPdf } from "../pdf/componentes-impressao-pdf";
import { DEF_RT_MAIS_CHAMADOS_AGORA } from "../metadados";
import type { BlocoModulo, SupabaseServerClient } from "../types";

const STATUS_ABERTO = new Set(["aberto", "em_andamento"]);
const TOP_N = 5;

type LinhaRt = { codigo: string; nome: string; total: number };
type Dados = { rts: LinhaRt[] };

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function buscar(supabase: SupabaseServerClient): Promise<Dados> {
  const { data, error } = await supabase.from("chamados").select("status, rt_id, rts(codigo, nome)");
  if (error) throw new Error(error.message);

  const volumePorRt = new Map<string, LinhaRt>();
  for (const c of data ?? []) {
    if (!STATUS_ABERTO.has(c.status as string)) continue;
    const rt = unwrapOne(c.rts);
    if (!rt) continue;
    const chave = c.rt_id as string;
    const atual = volumePorRt.get(chave);
    if (atual) atual.total++;
    else volumePorRt.set(chave, { codigo: rt.codigo as string, nome: rt.nome as string, total: 1 });
  }

  const rts = [...volumePorRt.values()].sort((a, b) => b.total - a.total).slice(0, TOP_N);
  return { rts };
}

function resumoFrase(dados: Dados): string | null {
  const primeira = dados.rts[0];
  if (!primeira) return null;
  return `A RT com mais chamados abertos agora é ${primeira.codigo} — ${primeira.nome}, com ${primeira.total} chamados.`;
}

function Secao({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorio titulo="RTs com mais chamados abertos" subtitulo={`Top ${TOP_N} — dado atual, não depende do período.`}>
      {dados.rts.length === 0 ? (
        <SemDados>Nenhum chamado aberto no momento.</SemDados>
      ) : (
        <Tabela colunas={["RT", "Chamados abertos"]}>
          {dados.rts.map((rt) => (
            <tr key={rt.codigo}>
              <td>
                {rt.codigo} — {rt.nome}
              </td>
              <td>{rt.total}</td>
            </tr>
          ))}
        </Tabela>
      )}
    </SecaoRelatorio>
  );
}

function SecaoPdf({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorioPdf titulo="RTs com mais chamados abertos" subtitulo={`Top ${TOP_N} — dado atual, não depende do período.`}>
      {dados.rts.length === 0 ? (
        <SemDadosPdf>Nenhum chamado aberto no momento.</SemDadosPdf>
      ) : (
        <TabelaPdf
          colunas={["RT", "Chamados abertos"]}
          linhas={dados.rts.map((rt) => [`${rt.codigo} — ${rt.nome}`, rt.total])}
        />
      )}
    </SecaoRelatorioPdf>
  );
}

export const rtMaisChamadosAgora: BlocoModulo<Dados> = {
  definicao: DEF_RT_MAIS_CHAMADOS_AGORA,
  buscar,
  resumoFrase,
  Secao,
  SecaoPdf,
};
