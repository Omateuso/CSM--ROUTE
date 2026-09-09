"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ReexecucaoState = { error: string | null; criados?: number };

function traduzErro(error: { code?: string; message: string }): string {
  if (error.code === "42501") return "Você não tem permissão pra programar uma nova execução.";
  if (error.code === "23503") {
    return "A rota ou o técnico selecionado não existe mais — atualize a página e tente de novo.";
  }
  // P0001 = raise exception dentro de fn_programar_reexecucao (mensagem já em pt-BR).
  if (error.code === "P0001") return error.message;
  return `Não foi possível programar a nova execução (${error.message}).`;
}

export async function programarReexecucao(
  _prev: ReexecucaoState,
  formData: FormData,
): Promise<ReexecucaoState> {
  const servicoId = String(formData.get("servicoId") ?? "");
  const rotaId = String(formData.get("rotaId") ?? "");
  const tecnicoId = String(formData.get("tecnicoId") ?? "");
  const observacao = String(formData.get("observacao") ?? "").trim();

  if (!servicoId) return { error: "Pendência inválida." };
  if (!rotaId) return { error: "Escolha a rota que vai receber a nova execução." };
  if (!tecnicoId) return { error: "Escolha o técnico responsável." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_programar_reexecucao", {
    p_servico_cancelado_id: servicoId,
    p_rota_id: rotaId,
    p_tecnico_id: tecnicoId,
    p_observacao: observacao || null,
  });

  if (error) return { error: traduzErro(error) };

  revalidatePath("/pendencias");
  revalidatePath("/servicos-do-dia");
  revalidatePath("/rotas/confirmadas");
  return { error: null, criados: (data as number) ?? 0 };
}
