import { SecaoRelatorio, GradeStats, Stat, Tabela, SemDados } from "../componentes-impressao";
import { SecaoRelatorioPdf, GradeStatsPdf, StatPdf, TabelaPdf, SemDadosPdf } from "../pdf/componentes-impressao-pdf";
import { DEF_GARGALOS_AGORA } from "../metadados";
import type { BlocoModulo, SupabaseServerClient } from "../types";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type LinhaTravado = { rt: string; assunto: string; protocolo: string | null };
type Dados = { aguardandoValidacao: number; travados: number; exemplosTravados: LinhaTravado[] };

const EXEMPLOS_TRAVADOS_MAX = 8;

async function buscar(supabase: SupabaseServerClient): Promise<Dados> {
  const hoje = new Date().toISOString().slice(0, 10);

  const [{ count: aguardandoValidacao, error: erroAguardando }, { data: travadosRaw, error: erroTravados }] =
    await Promise.all([
      supabase.from("servicos").select("id", { count: "exact", head: true }).eq("status", "concluido_tecnico"),
      supabase
        .from("servicos")
        .select("id, chamados(assunto, tomticket_id), rts(codigo), rotas!inner(data)")
        // "travados" já era uma soma de planejado+em_execucao neste bloco
        // (o relatório não distingue os dois, só "parado numa rota
        // vencida") — em_revisao (0053/0054) entra na mesma soma por
        // consistência com esse nível de granularidade do relatório.
        .in("status", ["planejado", "em_execucao", "em_revisao"])
        .lt("rotas.data", hoje),
    ]);

  if (erroAguardando) throw new Error(erroAguardando.message);
  if (erroTravados) throw new Error(erroTravados.message);

  const exemplosTravados: LinhaTravado[] = (travadosRaw ?? []).slice(0, EXEMPLOS_TRAVADOS_MAX).map((s) => {
    const chamado = unwrapOne(s.chamados);
    const rt = unwrapOne(s.rts);
    return {
      rt: (rt?.codigo as string) ?? "—",
      assunto: (chamado?.assunto as string) ?? "—",
      protocolo: (chamado?.tomticket_id as string) ?? null,
    };
  });

  return {
    aguardandoValidacao: aguardandoValidacao ?? 0,
    travados: (travadosRaw ?? []).length,
    exemplosTravados,
  };
}

function resumoFrase(dados: Dados): string | null {
  if (dados.aguardandoValidacao === 0 && dados.travados === 0) {
    return "Não há gargalos no momento: nada aguardando validação nem travado em rota já passada.";
  }
  return `Há ${dados.aguardandoValidacao} serviço(s) aguardando validação e ${dados.travados} travado(s) em rota já passada.`;
}

function Secao({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorio
      titulo="Gargalos atuais"
      subtitulo="Serviços concluídos sem validação e serviços parados numa rota já vencida — dado atual."
    >
      <GradeStats>
        <Stat label="Aguardando validação" valor={dados.aguardandoValidacao} />
        <Stat label="Travados em rota passada" valor={dados.travados} destaque={dados.travados > 0} />
      </GradeStats>
      {dados.exemplosTravados.length > 0 && (
        <Tabela colunas={["RT", "Chamado", "Protocolo"]}>
          {dados.exemplosTravados.map((linha, indice) => (
            <tr key={indice}>
              <td>{linha.rt}</td>
              <td>{linha.assunto}</td>
              <td>{linha.protocolo ? `#${linha.protocolo}` : "—"}</td>
            </tr>
          ))}
        </Tabela>
      )}
      {dados.travados > EXEMPLOS_TRAVADOS_MAX && (
        <SemDados>
          + {dados.travados - EXEMPLOS_TRAVADOS_MAX} outro(s) travado(s), não listado(s) aqui — ver detalhes em
          Validação.
        </SemDados>
      )}
    </SecaoRelatorio>
  );
}

function SecaoPdf({ dados }: { dados: Dados }) {
  return (
    <SecaoRelatorioPdf
      titulo="Gargalos atuais"
      subtitulo="Serviços concluídos sem validação e serviços parados numa rota já vencida — dado atual."
    >
      <GradeStatsPdf>
        <StatPdf label="Aguardando validação" valor={dados.aguardandoValidacao} />
        <StatPdf label="Travados em rota passada" valor={dados.travados} destaque={dados.travados > 0} />
      </GradeStatsPdf>
      {dados.exemplosTravados.length > 0 && (
        <TabelaPdf
          colunas={["RT", "Chamado", "Protocolo"]}
          linhas={dados.exemplosTravados.map((linha) => [
            linha.rt,
            linha.assunto,
            linha.protocolo ? `#${linha.protocolo}` : "—",
          ])}
        />
      )}
      {dados.travados > EXEMPLOS_TRAVADOS_MAX && (
        <SemDadosPdf>
          + {dados.travados - EXEMPLOS_TRAVADOS_MAX} outro(s) travado(s), não listado(s) aqui — ver detalhes em
          Validação.
        </SemDadosPdf>
      )}
    </SecaoRelatorioPdf>
  );
}

export const gargalosAgora: BlocoModulo<Dados> = {
  definicao: DEF_GARGALOS_AGORA,
  buscar,
  resumoFrase,
  Secao,
  SecaoPdf,
};
