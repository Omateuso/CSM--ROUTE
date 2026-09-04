import { SecaoRelatorio, Tabela, SemDados } from "../componentes-impressao";
import { SecaoRelatorioPdf, TabelaPdf, SemDadosPdf } from "../pdf/componentes-impressao-pdf";
import { DEF_RT_MAIS_ATENDIDA_PERIODO } from "../metadados";
import type { BlocoModulo, Periodo, SupabaseServerClient } from "../types";

const STATUS_CONCLUIDO = new Set(["concluido_tecnico", "validado"]);
const TOP_N = 5;

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type LinhaRt = { codigo: string; nome: string; total: number };
type Dados = { rts: LinhaRt[]; periodo: Periodo };

async function buscar(supabase: SupabaseServerClient, periodo?: Periodo): Promise<Dados> {
  if (!periodo) throw new Error("Bloco 'RT mais atendida' precisa de um período.");

  const { data, error } = await supabase
    .from("servicos")
    .select("status, concluido_em, rts(codigo, nome)")
    .gte("concluido_em", `${periodo.inicio}T00:00:00`)
    .lte("concluido_em", `${periodo.fim}T23:59:59`);
  if (error) throw new Error(error.message);

  const porRt = new Map<string, LinhaRt>();
  for (const s of data ?? []) {
    if (!STATUS_CONCLUIDO.has(s.status as string)) continue;
    const rt = unwrapOne(s.rts);
    if (!rt) continue;
    const chave = rt.codigo as string;
    const atual = porRt.get(chave);
    if (atual) atual.total++;
    else porRt.set(chave, { codigo: rt.codigo as string, nome: rt.nome as string, total: 1 });
  }

  const rts = [...porRt.values()].sort((a, b) => b.total - a.total).slice(0, TOP_N);
  return { rts, periodo };
}

function resumoFrase(dados: Dados): string | null {
  const primeira = dados.rts[0];
  if (!primeira) return `Nenhum serviço concluído no período de ${formatarPeriodo(dados.periodo)}.`;
  return `No período de ${formatarPeriodo(dados.periodo)}, a RT mais atendida foi ${primeira.codigo} — ${primeira.nome}, com ${primeira.total} serviço(s) concluído(s).`;
}

function formatarPeriodo(periodo: Periodo): string {
  const f = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${f.format(new Date(`${periodo.inicio}T00:00:00`))} a ${f.format(new Date(`${periodo.fim}T00:00:00`))}`;
}

function Secao({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorio
      titulo="RT mais atendida no período"
      subtitulo={`Serviços concluídos/validados, ${formatarPeriodo(dados.periodo)} — mede atendimento realizado, não demanda.`}
    >
      {dados.rts.length === 0 ? (
        <SemDados>Nenhum serviço concluído no período.</SemDados>
      ) : (
        <Tabela colunas={["RT", "Serviços concluídos"]}>
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
    <SecaoRelatorioPdf
      titulo="RT mais atendida no período"
      subtitulo={`Serviços concluídos/validados, ${formatarPeriodo(dados.periodo)} — mede atendimento realizado, não demanda.`}
    >
      {dados.rts.length === 0 ? (
        <SemDadosPdf>Nenhum serviço concluído no período.</SemDadosPdf>
      ) : (
        <TabelaPdf
          colunas={["RT", "Serviços concluídos"]}
          linhas={dados.rts.map((rt) => [`${rt.codigo} — ${rt.nome}`, rt.total])}
        />
      )}
    </SecaoRelatorioPdf>
  );
}

export const rtMaisAtendidaPeriodo: BlocoModulo<Dados> = {
  definicao: DEF_RT_MAIS_ATENDIDA_PERIODO,
  buscar,
  resumoFrase,
  Secao,
  SecaoPdf,
};
