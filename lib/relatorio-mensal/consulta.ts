import type { SupabaseServerClient } from "@/lib/relatorio/types";
import type {
  AlertasPreview,
  FiltroRelatorioMensal,
  ResumoPeriodo,
  ServicoRelatorio,
} from "./tipos";

// PostgREST devolve relação embutida ora como objeto, ora como array (depende
// da cardinalidade que ele infere) — mesmo utilitário que os blocos de
// lib/relatorio/ usam. Deixa o supabase-js inferir os tipos do próprio select,
// sem cast em `data` (o cast mataria essa inferência).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
function unwrapMany<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

/**
 * Serviços `validado` cujo `concluido_em` cai no período. Filtro de CAPS/região
 * aplicado em JS (volume ~centenas por mês, não vale `.eq` aninhado). Ordena
 * por CAPS → RT → data, pra a página de serviço do documento sair agrupada por
 * RT dentro de cada CAPS (seção 8 do prompt).
 */
export async function buscarServicosValidados(
  supabase: SupabaseServerClient,
  filtro: FiltroRelatorioMensal,
): Promise<ServicoRelatorio[]> {
  const { data, error } = await supabase
    .from("servicos")
    .select(
      `
      id, concluido_em,
      chamados ( tomticket_id, assunto, prioridade, criado_em ),
      rts ( codigo, nome, endereco, bairro, caps_id, regiao_id, regioes ( nome ), caps ( nome ) ),
      conclusoes ( observacao ),
      evidencias ( tipo, momento, storage_path )
    `,
    )
    .eq("status", "validado")
    .gte("concluido_em", `${filtro.inicio}T00:00:00`)
    .lte("concluido_em", `${filtro.fim}T23:59:59`);

  if (error) throw new Error(error.message);

  const linhas: ServicoRelatorio[] = [];
  for (const s of data ?? []) {
    const chamado = unwrapOne(s.chamados);
    const rt = unwrapOne(s.rts);
    if (!chamado || !rt) continue;

    if (filtro.capsId && rt.caps_id !== filtro.capsId) continue;
    if (filtro.regiaoId && rt.regiao_id !== filtro.regiaoId) continue;

    const evid = unwrapMany(s.evidencias);
    const os = evid.find((e) => e.tipo === "os");
    const antes = evid.find((e) => e.tipo === "foto" && e.momento === "antes");
    const depois = evid.find((e) => e.tipo === "foto" && e.momento === "depois");
    const observacao = unwrapOne(s.conclusoes)?.observacao;

    linhas.push({
      servicoId: s.id,
      protocolo: chamado.tomticket_id ?? "—",
      assunto: chamado.assunto ?? "—",
      servicoExecutado: observacao && observacao.trim() ? observacao : "—",
      concluidoEm: s.concluido_em as string,
      prioridade: chamado.prioridade ?? "normal",
      chamadoCriadoEm: (chamado.criado_em as string | null) ?? null,
      rtCodigo: rt.codigo,
      rtNome: rt.nome,
      rtEndereco: rt.endereco,
      rtBairro: rt.bairro,
      regiaoNome: unwrapOne(rt.regioes)?.nome ?? "—",
      capsNome: unwrapOne(rt.caps)?.nome ?? "—",
      osPath: os?.storage_path ?? null,
      fotoAntesPath: antes?.storage_path ?? null,
      fotoDepoisPath: depois?.storage_path ?? null,
    });
  }

  linhas.sort(
    (a, b) =>
      a.capsNome.localeCompare(b.capsNome, "pt-BR") ||
      a.rtCodigo.localeCompare(b.rtCodigo, "pt-BR", { numeric: true }) ||
      a.concluidoEm.localeCompare(b.concluidoEm),
  );
  return linhas;
}

export function resumoDoPeriodo(servicos: ServicoRelatorio[]): ResumoPeriodo {
  const rts = new Set(servicos.map((s) => s.rtCodigo));
  const porCapsMap = new Map<string, number>();
  for (const s of servicos) porCapsMap.set(s.capsNome, (porCapsMap.get(s.capsNome) ?? 0) + 1);
  const porCaps = [...porCapsMap.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
  return { totalServicos: servicos.length, totalRts: rts.size, totalCaps: porCaps.length, porCaps };
}

export function alertasDoPeriodo(servicos: ServicoRelatorio[]): AlertasPreview {
  return {
    semOs: servicos.filter((s) => !s.osPath).length,
    semFotoAntes: servicos.filter((s) => !s.fotoAntesPath).length,
    semFotoDepois: servicos.filter((s) => !s.fotoDepoisPath).length,
  };
}
