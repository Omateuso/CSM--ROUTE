import { SecaoRelatorio, Tabela, SemDados } from "../componentes-impressao";
import { SecaoRelatorioPdf, TabelaPdf, SemDadosPdf } from "../pdf/componentes-impressao-pdf";
import { DEF_VOLUME_REGIAO_PERIODO } from "../metadados";
import type { BlocoModulo, Periodo, SupabaseServerClient } from "../types";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type LinhaRegiao = { regiao: string; zona: string; total: number };
type Dados = { regioes: LinhaRegiao[]; totalGeral: number; periodo: Periodo };

async function buscar(supabase: SupabaseServerClient, periodo?: Periodo): Promise<Dados> {
  if (!periodo) throw new Error("Bloco 'Volume por região' precisa de um período.");

  const { data, error } = await supabase
    .from("chamados")
    .select("criado_em, rts(regioes(nome, zonas(nome)))")
    .gte("criado_em", `${periodo.inicio}T00:00:00`)
    .lte("criado_em", `${periodo.fim}T23:59:59`);
  if (error) throw new Error(error.message);

  const porRegiao = new Map<string, LinhaRegiao>();
  for (const c of data ?? []) {
    const rt = unwrapOne(c.rts);
    const regiao = unwrapOne(rt?.regioes);
    const nomeRegiao = regiao?.nome ?? "—";
    const nomeZona = unwrapOne(regiao?.zonas)?.nome ?? "—";
    const atual = porRegiao.get(nomeRegiao);
    if (atual) atual.total++;
    else porRegiao.set(nomeRegiao, { regiao: nomeRegiao, zona: nomeZona, total: 1 });
  }

  const regioes = [...porRegiao.values()].sort((a, b) => b.total - a.total);
  const totalGeral = regioes.reduce((soma, r) => soma + r.total, 0);
  return { regioes, totalGeral, periodo };
}

function formatarPeriodo(periodo: Periodo): string {
  const f = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${f.format(new Date(`${periodo.inicio}T00:00:00`))} a ${f.format(new Date(`${periodo.fim}T00:00:00`))}`;
}

function resumoFrase(dados: Dados): string {
  return `No período de ${formatarPeriodo(dados.periodo)}, foram abertos ${dados.totalGeral} chamados, distribuídos em ${dados.regioes.length} região(ões).`;
}

function Secao({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorio titulo="Volume de chamados por região" subtitulo={formatarPeriodo(dados.periodo)}>
      {dados.regioes.length === 0 ? (
        <SemDados>Nenhum chamado aberto no período.</SemDados>
      ) : (
        <Tabela colunas={["Região", "Zona", "Chamados abertos no período"]}>
          {dados.regioes.map((r) => (
            <tr key={r.regiao}>
              <td>{r.regiao}</td>
              <td>{r.zona}</td>
              <td>{r.total}</td>
            </tr>
          ))}
        </Tabela>
      )}
    </SecaoRelatorio>
  );
}

function SecaoPdf({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorioPdf titulo="Volume de chamados por região" subtitulo={formatarPeriodo(dados.periodo)}>
      {dados.regioes.length === 0 ? (
        <SemDadosPdf>Nenhum chamado aberto no período.</SemDadosPdf>
      ) : (
        <TabelaPdf
          colunas={["Região", "Zona", "Chamados abertos no período"]}
          linhas={dados.regioes.map((r) => [r.regiao, r.zona, r.total])}
        />
      )}
    </SecaoRelatorioPdf>
  );
}

export const volumeRegiaoPeriodo: BlocoModulo<Dados> = {
  definicao: DEF_VOLUME_REGIAO_PERIODO,
  buscar,
  resumoFrase,
  Secao,
  SecaoPdf,
};
