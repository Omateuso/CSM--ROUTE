import { SecaoRelatorio, GradeStats, Stat, SemDados } from "../componentes-impressao";
import { SecaoRelatorioPdf, GradeStatsPdf, StatPdf, SemDadosPdf } from "../pdf/componentes-impressao-pdf";
import { DEF_ROTAS_PERIODO } from "../metadados";
import type { BlocoModulo, Periodo, SupabaseServerClient } from "../types";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type Dados = { qtdRotas: number; qtdEquipes: number; qtdRtsCobertas: number; periodo: Periodo };

async function buscar(supabase: SupabaseServerClient, periodo?: Periodo): Promise<Dados> {
  if (!periodo) throw new Error("Bloco 'Rotas no período' precisa de um período.");

  const { data: rotasRaw, error } = await supabase
    .from("rotas")
    .select("id, equipe_id, equipes(nome)")
    .eq("status", "confirmada")
    .gte("data", periodo.inicio)
    .lte("data", periodo.fim);
  if (error) throw new Error(error.message);

  const equipesEnvolvidas = new Set<string>();
  for (const r of rotasRaw ?? []) {
    const equipe = unwrapOne(r.equipes);
    equipesEnvolvidas.add((equipe?.nome as string) ?? (r.equipe_id as string) ?? "—");
  }

  const rotaIds = (rotasRaw ?? []).map((r) => r.id as string);
  const { data: rotaRtsRaw, error: erroRotaRts } =
    rotaIds.length > 0 ? await supabase.from("rota_rts").select("rt_id").in("rota_id", rotaIds) : { data: [], error: null };
  if (erroRotaRts) throw new Error(erroRotaRts.message);

  const rtsCobertas = new Set((rotaRtsRaw ?? []).map((rr) => rr.rt_id as string));

  return {
    qtdRotas: (rotasRaw ?? []).length,
    qtdEquipes: equipesEnvolvidas.size,
    qtdRtsCobertas: rtsCobertas.size,
    periodo,
  };
}

function formatarPeriodo(periodo: Periodo): string {
  const f = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${f.format(new Date(`${periodo.inicio}T00:00:00`))} a ${f.format(new Date(`${periodo.fim}T00:00:00`))}`;
}

function resumoFrase(dados: Dados): string {
  if (dados.qtdRotas === 0) return `Nenhuma rota confirmada no período de ${formatarPeriodo(dados.periodo)}.`;
  return `Foram confirmadas ${dados.qtdRotas} rota(s) no período de ${formatarPeriodo(dados.periodo)}, envolvendo ${dados.qtdEquipes} equipe(s) e cobrindo ${dados.qtdRtsCobertas} RT(s) distintas.`;
}

function Secao({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorio titulo="Rotas confirmadas no período" subtitulo={formatarPeriodo(dados.periodo)}>
      {dados.qtdRotas === 0 ? (
        <SemDados>Nenhuma rota confirmada no período.</SemDados>
      ) : (
        <GradeStats>
          <Stat label="Rotas confirmadas" valor={dados.qtdRotas} />
          <Stat label="Equipes envolvidas" valor={dados.qtdEquipes} />
          <Stat label="RTs cobertas" valor={dados.qtdRtsCobertas} />
        </GradeStats>
      )}
    </SecaoRelatorio>
  );
}

function SecaoPdf({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorioPdf titulo="Rotas confirmadas no período" subtitulo={formatarPeriodo(dados.periodo)}>
      {dados.qtdRotas === 0 ? (
        <SemDadosPdf>Nenhuma rota confirmada no período.</SemDadosPdf>
      ) : (
        <GradeStatsPdf>
          <StatPdf label="Rotas confirmadas" valor={dados.qtdRotas} />
          <StatPdf label="Equipes envolvidas" valor={dados.qtdEquipes} />
          <StatPdf label="RTs cobertas" valor={dados.qtdRtsCobertas} />
        </GradeStatsPdf>
      )}
    </SecaoRelatorioPdf>
  );
}

export const rotasPeriodo: BlocoModulo<Dados> = {
  definicao: DEF_ROTAS_PERIODO,
  buscar,
  resumoFrase,
  Secao,
  SecaoPdf,
};
