import { computeSlaStatus } from "@/lib/sla";
import { SecaoRelatorio, GradeStats, Stat, Tabela } from "../componentes-impressao";
import { SecaoRelatorioPdf, GradeStatsPdf, StatPdf, TabelaPdf } from "../pdf/componentes-impressao-pdf";
import { DEF_PANORAMA_CHAMADOS_AGORA } from "../metadados";
import type { BlocoModulo, SupabaseServerClient } from "../types";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";

// "Aberto" pro propósito do relatório = mesma convenção usada em todo o
// resto do app (dashboard, painel) — cobre os dois status que o import
// real do TomTicket usa hoje.
const STATUS_ABERTO = new Set(["aberto", "em_andamento"]);

type Dados = {
  totalAbertos: number;
  totalCriticos: number;
  totalSlaVencido: number;
  porPrioridade: { emergencial: number; alta: number; normal: number; baixa: number };
};

async function buscar(supabase: SupabaseServerClient): Promise<Dados> {
  const { data, error } = await todasAsLinhas(() =>
    supabase.from("chamados").select("prioridade, status, sla_prazo").order("id"),
  );
  if (error) throw new Error(error.message);

  const porPrioridade = { emergencial: 0, alta: 0, normal: 0, baixa: 0 };
  let totalAbertos = 0;
  let totalCriticos = 0;
  let totalSlaVencido = 0;

  for (const c of data ?? []) {
    if (!STATUS_ABERTO.has(c.status as string)) continue;
    totalAbertos++;
    const prioridade = c.prioridade as keyof typeof porPrioridade;
    porPrioridade[prioridade]++;
    if (prioridade === "emergencial") totalCriticos++;
    if (computeSlaStatus(c.sla_prazo as string | null) === "vencido") totalSlaVencido++;
  }

  return { totalAbertos, totalCriticos, totalSlaVencido, porPrioridade };
}

function resumoFrase(dados: Dados): string {
  if (dados.totalAbertos === 0) return "Não há chamados abertos no momento.";
  return `Atualmente há ${dados.totalAbertos} chamados abertos, sendo ${dados.totalCriticos} emergenciais e ${dados.totalSlaVencido} com SLA vencido.`;
}

function Secao({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorio
      titulo="Panorama de chamados agora"
      subtitulo="Fotografia do estado atual do banco — não depende do período selecionado."
    >
      <GradeStats>
        <Stat label="Chamados abertos" valor={dados.totalAbertos} />
        <Stat label="Críticos (emergencial)" valor={dados.totalCriticos} destaque />
        <Stat label="SLA vencido" valor={dados.totalSlaVencido} destaque />
      </GradeStats>
      <Tabela colunas={["Prioridade", "Quantidade"]}>
        <tr>
          <td>Emergencial</td>
          <td>{dados.porPrioridade.emergencial}</td>
        </tr>
        <tr>
          <td>Alta</td>
          <td>{dados.porPrioridade.alta}</td>
        </tr>
        <tr>
          <td>Normal</td>
          <td>{dados.porPrioridade.normal}</td>
        </tr>
        <tr>
          <td>Baixa</td>
          <td>{dados.porPrioridade.baixa}</td>
        </tr>
      </Tabela>
    </SecaoRelatorio>
  );
}

function SecaoPdf({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorioPdf
      titulo="Panorama de chamados agora"
      subtitulo="Fotografia do estado atual do banco — não depende do período selecionado."
    >
      <GradeStatsPdf>
        <StatPdf label="Chamados abertos" valor={dados.totalAbertos} />
        <StatPdf label="Críticos (emergencial)" valor={dados.totalCriticos} destaque />
        <StatPdf label="SLA vencido" valor={dados.totalSlaVencido} destaque />
      </GradeStatsPdf>
      <TabelaPdf
        colunas={["Prioridade", "Quantidade"]}
        linhas={[
          ["Emergencial", dados.porPrioridade.emergencial],
          ["Alta", dados.porPrioridade.alta],
          ["Normal", dados.porPrioridade.normal],
          ["Baixa", dados.porPrioridade.baixa],
        ]}
      />
    </SecaoRelatorioPdf>
  );
}

export const panoramaChamadosAgora: BlocoModulo<Dados> = {
  definicao: DEF_PANORAMA_CHAMADOS_AGORA,
  buscar,
  resumoFrase,
  Secao,
  SecaoPdf,
};
