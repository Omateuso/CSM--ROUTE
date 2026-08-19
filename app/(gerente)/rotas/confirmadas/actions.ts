"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

function traduzErro(error: { code?: string; message: string }): string {
  // P0001 = `raise exception` dentro de fn_corrigir_data_rota (migration
  // 0016) — a mensagem já vem pronta em português.
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Você não tem permissão pra corrigir a data dessa rota.";
  return `Não foi possível corrigir a data (${error.message}).`;
}

// Correção estreita, de propósito: só a data, só enquanto nenhum serviço
// da rota foi iniciado — fn_corrigir_data_rota valida isso no servidor.
// Rota confirmada continua histórico imutável em tudo o mais.
export async function corrigirDataRota(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rotaId = String(formData.get("rotaId") ?? "");
  const novaData = String(formData.get("novaData") ?? "");
  if (!rotaId) return { error: "Rota inválida." };
  if (!novaData) return { error: "Selecione a nova data." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_corrigir_data_rota", {
    p_rota_id: rotaId,
    p_nova_data: novaData,
  });

  if (error) return { error: traduzErro(error) };

  revalidatePath("/rotas/confirmadas");
  return { error: null };
}
