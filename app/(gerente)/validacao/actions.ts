"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

function traduzErro(error: { code?: string; message: string }): string {
  // P0001 = `raise exception` dentro de fn_validar_servico/fn_reagendar_servico
  // (migration 0018) — a mensagem já vem pronta em português.
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Você não tem permissão pra essa ação.";
  return `Não foi possível concluir a ação (${error.message}).`;
}

export async function validarServico(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const servicoId = String(formData.get("servicoId") ?? "");
  if (!servicoId) return { error: "Serviço inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_validar_servico", { p_servico_id: servicoId });
  if (error) return { error: traduzErro(error) };

  revalidatePath("/validacao");
  revalidatePath("/dashboard");
  return { error: null };
}

// Cancela o serviço travado (planejado/em_execucao que não vai ser
// concluído) sem tocar em `chamados.status` — o chamado volta a ser
// candidato normal na próxima rota que incluir aquela RT (fn_confirmar_rota
// ignora serviço `cancelado` na checagem de duplicata, ver 0018).
export async function reagendarServico(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const servicoId = String(formData.get("servicoId") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!servicoId) return { error: "Serviço inválido." };
  if (!motivo) return { error: "Informe o motivo do reagendamento." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_reagendar_servico", {
    p_servico_id: servicoId,
    p_motivo: motivo,
  });
  if (error) return { error: traduzErro(error) };

  revalidatePath("/validacao");
  revalidatePath("/dashboard");
  return { error: null };
}

// Migration 0025 (achado de uso real, 21/08/2026): diferente de reagendar
// (serviço nunca atendido), recusar é pra quando o gerente não confia na
// evidência de um serviço JÁ concluído pelo técnico — cancela e libera o
// chamado pra próxima rota, mesmo efeito de banco do reagendamento, mas
// evento de histórico próprio (`servico_recusado`).
export async function recusarServico(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const servicoId = String(formData.get("servicoId") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!servicoId) return { error: "Serviço inválido." };
  if (!motivo) return { error: "Informe o motivo da recusa." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_recusar_servico", {
    p_servico_id: servicoId,
    p_motivo: motivo,
  });
  if (error) return { error: traduzErro(error) };

  revalidatePath("/validacao");
  revalidatePath("/dashboard");
  return { error: null };
}
