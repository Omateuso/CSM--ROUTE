import { SecaoRelatorio, GradeStats, Stat, SemDados } from "../componentes-impressao";
import { SecaoRelatorioPdf, GradeStatsPdf, StatPdf, SemDadosPdf } from "../pdf/componentes-impressao-pdf";
import { DEF_CUMPRIMENTO_SLA_PERIODO } from "../metadados";
import type { BlocoModulo, Periodo, SupabaseServerClient } from "../types";

const STATUS_CONCLUIDO = new Set(["concluido_tecnico", "validado"]);

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type Dados = { total: number; dentroPrazo: number; vencido: number; periodo: Periodo };

// Decisão de definição (registrada no plano): "cumprimento de SLA no
// período" usa o momento em que ESTE sistema concluiu o atendimento
// (servicos.concluido_em) comparado a chamados.sla_prazo — não
// chamados.status/atualizado_em, que só espelha o TomTicket e não tem
// timestamp confiável de quando o chamado foi de fato resolvido.
async function buscar(supabase: SupabaseServerClient, periodo?: Periodo): Promise<Dados> {
  if (!periodo) throw new Error("Bloco 'Cumprimento de SLA' precisa de um período.");

  const { data, error } = await supabase
    .from("servicos")
    .select("status, concluido_em, chamados(sla_prazo)")
    .gte("concluido_em", `${periodo.inicio}T00:00:00`)
    .lte("concluido_em", `${periodo.fim}T23:59:59`);
  if (error) throw new Error(error.message);

  let total = 0;
  let dentroPrazo = 0;
  for (const s of data ?? []) {
    if (!STATUS_CONCLUIDO.has(s.status as string)) continue;
    const chamado = unwrapOne(s.chamados);
    const slaPrazo = chamado?.sla_prazo as string | null;
    total++;
    if (!slaPrazo) {
      dentroPrazo++; // sem prazo definido = não há como estar vencido
      continue;
    }
    if (new Date(s.concluido_em as string).getTime() <= new Date(slaPrazo).getTime()) dentroPrazo++;
  }

  return { total, dentroPrazo, vencido: total - dentroPrazo, periodo };
}

function formatarPeriodo(periodo: Periodo): string {
  const f = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${f.format(new Date(`${periodo.inicio}T00:00:00`))} a ${f.format(new Date(`${periodo.fim}T00:00:00`))}`;
}

function resumoFrase(dados: Dados): string | null {
  if (dados.total === 0) return `Nenhum serviço concluído no período de ${formatarPeriodo(dados.periodo)}.`;
  const percentual = Math.round((dados.dentroPrazo / dados.total) * 100);
  return `No período de ${formatarPeriodo(dados.periodo)}, o SLA foi cumprido em ${percentual}% dos ${dados.total} atendimento(s) concluído(s).`;
}

function Secao({ dados }: { dados: Dados }) {
  const percentual = dados.total === 0 ? null : Math.round((dados.dentroPrazo / dados.total) * 100);
  return (
    <SecaoRelatorio
      titulo="Cumprimento de SLA no período"
      subtitulo={`${formatarPeriodo(dados.periodo)} — conclusão registrada pelo técnico neste sistema, comparada ao prazo do chamado.`}
    >
      {dados.total === 0 ? (
        <SemDados>Nenhum serviço concluído no período.</SemDados>
      ) : (
        <GradeStats>
          <Stat label="Cumprimento de SLA" valor={`${percentual}%`} />
          <Stat label="Dentro do prazo" valor={dados.dentroPrazo} />
          <Stat label="SLA vencido" valor={dados.vencido} destaque={dados.vencido > 0} />
        </GradeStats>
      )}
    </SecaoRelatorio>
  );
}

function SecaoPdf({ dados }: { dados: Dados }) {
  const percentual = dados.total === 0 ? null : Math.round((dados.dentroPrazo / dados.total) * 100);
  return (
    <SecaoRelatorioPdf
      titulo="Cumprimento de SLA no período"
      subtitulo={`${formatarPeriodo(dados.periodo)} — conclusão registrada pelo técnico neste sistema, comparada ao prazo do chamado.`}
    >
      {dados.total === 0 ? (
        <SemDadosPdf>Nenhum serviço concluído no período.</SemDadosPdf>
      ) : (
        <GradeStatsPdf>
          <StatPdf label="Cumprimento de SLA" valor={`${percentual}%`} />
          <StatPdf label="Dentro do prazo" valor={dados.dentroPrazo} />
          <StatPdf label="SLA vencido" valor={dados.vencido} destaque={dados.vencido > 0} />
        </GradeStatsPdf>
      )}
    </SecaoRelatorioPdf>
  );
}

export const cumprimentoSlaPeriodo: BlocoModulo<Dados> = {
  definicao: DEF_CUMPRIMENTO_SLA_PERIODO,
  buscar,
  resumoFrase,
  Secao,
  SecaoPdf,
};
