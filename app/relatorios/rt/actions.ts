"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { montarDocxRelatorioRt } from "@/lib/relatorio-rt/docx";
import type { RelatorioRtParaDocx } from "@/lib/relatorio-rt/tipos";

export type ActionState = {
  error: string | null;
  relatorioId?: string;
  rtId?: string;
  status?: "rascunho" | "finalizado";
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function traduzErro(error: { code?: string; message: string }): string {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Você não tem permissão pra essa ação.";
  return `Não foi possível concluir a ação (${error.message}).`;
}

// -----------------------------------------------------------------------------
// Busca de chamado — sempre escopada à RT já escolhida (diferente de
// buscarChamadosParaUrgencia em app/urgencias/actions.ts, que é uma busca
// global): aqui o vínculo só faz sentido dentro da mesma RT, então não
// precisa de texto livre nem de exclusões por status — inclusive um chamado
// já finalizado pode ser referenciado por um relatório posterior.
// -----------------------------------------------------------------------------
export type ChamadoDaRt = {
  id: string;
  tomticketId: string | null;
  assunto: string;
  status: string;
  criadoEm: string;
};

export async function buscarChamadosDaRt(rtId: string): Promise<ChamadoDaRt[]> {
  if (!rtId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chamados")
    .select("id, tomticket_id, assunto, status, criado_em")
    .eq("rt_id", rtId)
    .order("criado_em", { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data.map((c) => ({
    id: c.id as string,
    tomticketId: c.tomticket_id as string | null,
    assunto: c.assunto as string,
    status: c.status as string,
    criadoEm: c.criado_em as string,
  }));
}

// -----------------------------------------------------------------------------
// Salvar (rascunho ou finalizar) — upsert de uma linha só (sem RPC: nenhum
// invariante entre tabelas precisa de transação aqui, diferente de
// fn_confirmar_rota/fn_registrar_urgencia). "Insere primeiro, sobe arquivo
// depois" é o mesmo padrão de registrarUrgencia (app/urgencias/actions.ts).
// -----------------------------------------------------------------------------
export async function salvarRelatorioRt(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const acao = String(formData.get("acao") ?? "");
  const relatorioIdExistente = String(formData.get("relatorioId") ?? "") || null;
  const rtId = String(formData.get("rtId") ?? "");
  const chamadoId = String(formData.get("chamadoId") ?? "") || null;
  const assunto = String(formData.get("assunto") ?? "").trim();
  const relatoTecnico = String(formData.get("relatoTecnico") ?? "").trim();
  const encaminhamento = String(formData.get("encaminhamento") ?? "").trim();

  if (acao !== "rascunho" && acao !== "gerar") return { error: "Ação inválida." };
  if (!rtId) return { error: "Selecione a RT." };
  if (acao === "gerar") {
    if (!assunto) return { error: "Informe o assunto do relatório." };
    if (!relatoTecnico) return { error: "Escreva o relato técnico." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada — faça login de novo." };

  const camposBase = {
    rt_id: rtId,
    chamado_id: chamadoId,
    assunto: assunto || null,
    relato_tecnico: relatoTecnico || null,
    encaminhamento: encaminhamento || null,
    atualizado_em: new Date().toISOString(),
  };

  let relatorioId = relatorioIdExistente;

  if (relatorioId) {
    const { error } = await supabase.from("relatorios_rt").update(camposBase).eq("id", relatorioId);
    if (error) return { error: traduzErro(error) };
  } else {
    const { data: novo, error } = await supabase
      .from("relatorios_rt")
      .insert({ ...camposBase, responsavel_id: user.id })
      .select("id")
      .single();
    if (error || !novo) return { error: traduzErro(error ?? { message: "Falha ao criar o relatório." }) };
    relatorioId = novo.id as string;
  }

  // Fotos novas desta submissão — arquivo e legenda viajam em paralelo, na
  // mesma ordem (input escondido "fotosNovas", sincronizado via
  // DataTransfer, e inputs de texto "legendasNovas" na mesma ordem no DOM).
  const arquivos = formData.getAll("fotosNovas").filter((f): f is File => f instanceof File && f.size > 0);
  const legendas = formData.getAll("legendasNovas").map((l) => String(l).trim());

  if (arquivos.length > 0) {
    const { count } = await supabase
      .from("relatorios_rt_fotos")
      .select("id", { count: "exact", head: true })
      .eq("relatorio_id", relatorioId);
    let ordem = count ?? 0;

    for (let i = 0; i < arquivos.length; i++) {
      const arquivo = arquivos[i];
      const legenda = legendas[i] || null;
      const path = `${relatorioId}/foto-${ordem}-${Date.now()}-${sanitizeFileName(arquivo.name)}`;
      const { error: uploadError } = await supabase.storage.from("relatorios-rt").upload(path, arquivo);
      if (!uploadError) {
        await supabase
          .from("relatorios_rt_fotos")
          .insert({ relatorio_id: relatorioId, storage_path: path, legenda, ordem });
        ordem += 1;
      }
      // Falha isolada de upload não derruba o resto — mesma tolerância já
      // aceita em registrarUrgencia (o registro em si é o que importa).
    }
  }

  if (acao !== "gerar") {
    revalidatePath(`/relatorios/rt/${rtId}`);
    revalidatePath("/relatorios/rt");
    revalidatePath("/relatorios/rt/novo");
    return { error: null, relatorioId, rtId, status: "rascunho" };
  }

  // Recarrega tudo já persistido (inclusive fotos de sessões anteriores do
  // mesmo rascunho, não só as desta submissão) pra montar o docx com o
  // estado real do relatório.
  const [{ data: relatorioRaw }, { data: fotosRaw }] = await Promise.all([
    supabase
      .from("relatorios_rt")
      .select(
        "assunto, relato_tecnico, encaminhamento, criado_em, rts(codigo, nome, endereco, bairro, caps(nome)), chamados(tomticket_id, assunto), profiles(nome)",
      )
      .eq("id", relatorioId)
      .single(),
    supabase
      .from("relatorios_rt_fotos")
      .select("storage_path, legenda")
      .eq("relatorio_id", relatorioId)
      .order("ordem", { ascending: true }),
  ]);

  if (!relatorioRaw) return { error: "Não foi possível carregar o relatório pra gerar o documento." };

  const rt = unwrapOne(relatorioRaw.rts as unknown);
  const caps = unwrapOne((rt as { caps?: unknown } | null)?.caps);
  const chamado = unwrapOne(relatorioRaw.chamados as unknown);
  const responsavel = unwrapOne(relatorioRaw.profiles as unknown);

  const rtTipado = rt as { codigo?: string; nome?: string; endereco?: string; bairro?: string } | null;
  const capsTipado = caps as { nome?: string } | null;
  const chamadoTipado = chamado as { tomticket_id?: string | null; assunto?: string } | null;
  const responsavelTipado = responsavel as { nome?: string } | null;

  const paraDocx: RelatorioRtParaDocx = {
    assunto: relatorioRaw.assunto as string,
    relatoTecnico: relatorioRaw.relato_tecnico as string,
    encaminhamento: (relatorioRaw.encaminhamento as string | null) ?? null,
    criadoEm: relatorioRaw.criado_em as string,
    rt: {
      codigo: rtTipado?.codigo ?? "—",
      nome: rtTipado?.nome ?? "—",
      endereco: rtTipado?.endereco ?? "—",
      bairro: rtTipado?.bairro ?? "—",
      capsNome: capsTipado?.nome ?? "—",
    },
    chamado: chamadoTipado
      ? { tomticketId: chamadoTipado.tomticket_id ?? null, assunto: chamadoTipado.assunto ?? "—" }
      : null,
    responsavelNome: responsavelTipado?.nome ?? "—",
    fotos: (fotosRaw ?? []).map((f) => ({
      storagePath: f.storage_path as string,
      legenda: (f.legenda as string | null) ?? null,
    })),
  };

  const buffer = await montarDocxRelatorioRt(supabase, paraDocx);
  const docxPath = `${relatorioId}/relatorio-${Date.now()}.docx`;
  const { error: uploadDocxError } = await supabase.storage.from("relatorios-rt").upload(docxPath, buffer, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  if (uploadDocxError) return { error: traduzErro(uploadDocxError) };

  const { error: finalizeError } = await supabase
    .from("relatorios_rt")
    .update({ status: "finalizado", docx_path: docxPath, gerado_em: new Date().toISOString() })
    .eq("id", relatorioId);
  if (finalizeError) return { error: traduzErro(finalizeError) };

  revalidatePath(`/relatorios/rt/${rtId}`);
  revalidatePath("/relatorios/rt");
  return { error: null, relatorioId, rtId, status: "finalizado" };
}

// Ação isolada e imediata (não fica dentro do formulário grande) — remove
// uma foto já persistida enquanto o relatório ainda é rascunho; a RLS
// (relatorios_rt_fotos_delete_gerente_rascunho) já recusa depois de
// finalizado, então não precisa checar status aqui de novo.
export async function removerFotoRelatorio(fotoId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("relatorios_rt_fotos").delete().eq("id", fotoId);
  revalidatePath("/relatorios/rt/novo");
}
