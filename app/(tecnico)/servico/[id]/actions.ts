"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

function traduzErro(error: { code?: string; message: string }): string {
  // P0001 = `raise exception` dentro de fn_iniciar_servico/fn_concluir_servico
  // (migration 0014) — a mensagem já vem pronta em português.
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Você não tem permissão pra essa ação.";
  return `Não foi possível concluir a ação (${error.message}).`;
}

export async function iniciarServico(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const servicoId = String(formData.get("servicoId") ?? "");
  if (!servicoId) return { error: "Serviço inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_iniciar_servico", { p_servico_id: servicoId });
  if (error) return { error: traduzErro(error) };

  revalidatePath(`/servico/${servicoId}`);
  revalidatePath("/servicos-do-dia");
  return { error: null };
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

// Upload das evidências + fn_concluir_servico numa ação só: o técnico
// preenche observação, anexa a OS (obrigatória) e opcionalmente foto(s), e
// um único toque em "Concluir" faz tudo — menos telas/toques no celular
// (persona técnico, CLAUDE.md). Foto virou opcional depois de teste real do
// usuário (18/08/2026) — só a OS continua obrigatória. fn_concluir_servico
// revalida de novo no servidor se a OS realmente existe antes de fechar o
// status (defesa em profundidade, não só confia na checagem feita aqui).
export async function concluirServico(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const servicoId = String(formData.get("servicoId") ?? "");
  const observacao = String(formData.get("observacao") ?? "").trim();
  if (!servicoId) return { error: "Serviço inválido." };
  if (!observacao) return { error: "Descreva o que foi feito antes de concluir." };

  const fotos = formData.getAll("fotos").filter((f): f is File => f instanceof File && f.size > 0);
  const osEntry = formData.get("os");
  const os = osEntry instanceof File && osEntry.size > 0 ? osEntry : null;

  if (!os) return { error: "Anexe a OS (foto ou PDF)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada — faça login de novo." };

  for (const foto of fotos) {
    const path = `${servicoId}/foto-${Date.now()}-${sanitizeFileName(foto.name)}`;
    const { error: uploadError } = await supabase.storage.from("evidencias").upload(path, foto);
    if (uploadError) return { error: `Falha ao enviar foto (${uploadError.message}).` };
    const { error: insertError } = await supabase
      .from("evidencias")
      .insert({ servico_id: servicoId, tipo: "foto", storage_path: path, criado_por: user.id });
    if (insertError) return { error: `Falha ao registrar foto (${insertError.message}).` };
  }

  const osPath = `${servicoId}/os-${Date.now()}-${sanitizeFileName(os.name)}`;
  const { error: osUploadError } = await supabase.storage.from("evidencias").upload(osPath, os);
  if (osUploadError) return { error: `Falha ao enviar a OS (${osUploadError.message}).` };
  const { error: osInsertError } = await supabase
    .from("evidencias")
    .insert({ servico_id: servicoId, tipo: "os", storage_path: osPath, criado_por: user.id });
  if (osInsertError) return { error: `Falha ao registrar a OS (${osInsertError.message}).` };

  const { error: concluirError } = await supabase.rpc("fn_concluir_servico", {
    p_servico_id: servicoId,
    p_observacao: observacao,
  });
  if (concluirError) return { error: traduzErro(concluirError) };

  revalidatePath(`/servico/${servicoId}`);
  revalidatePath("/servicos-do-dia");
  return { error: null };
}
