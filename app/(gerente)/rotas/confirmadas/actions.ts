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

// Cancelar a rota inteira — a saída pra quem confirmou errado (migration 0031).
// Não apaga nada: rota e serviços viram `cancelado`, o que devolve os chamados
// pro pool da próxima rota. `fn_cancelar_rota` recusa no servidor se algum
// serviço já saiu de `planejado`.
export async function cancelarRota(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rotaId = String(formData.get("rotaId") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!rotaId) return { error: "Rota inválida." };
  if (!motivo) return { error: "Informe o motivo do cancelamento." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cancelar_rota", { p_rota_id: rotaId, p_motivo: motivo });
  if (error) {
    if (error.code === "P0001") return { error: error.message };
    if (error.code === "42501") return { error: "Você não tem permissão pra cancelar essa rota." };
    return { error: `Não foi possível cancelar a rota (${error.message}).` };
  }

  revalidatePath("/rotas/confirmadas");
  revalidatePath("/dashboard");
  // A rota cancelada tem que sumir da tela do técnico na hora. Sem isto, os
  // serviços já estavam cancelados no banco mas a página seguia servindo a
  // versão em cache.
  revalidatePath("/servicos-do-dia");
  return { error: null };
}

// Trocar o técnico de UMA parada, sem mexer na composição da rota — o erro mais
// comum e o menos destrutivo de corrigir.
export async function trocarTecnicoParada(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rotaId = String(formData.get("rotaId") ?? "");
  const rtId = String(formData.get("rtId") ?? "");
  const tecnicoId = String(formData.get("tecnicoId") ?? "");
  if (!rotaId || !rtId) return { error: "Parada inválida." };
  if (!tecnicoId) return { error: "Selecione o técnico." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_trocar_tecnico_parada", {
    p_rota_id: rotaId,
    p_rt_id: rtId,
    p_tecnico_id: tecnicoId,
  });
  if (error) {
    if (error.code === "P0001") return { error: error.message };
    if (error.code === "42501") return { error: "Você não tem permissão pra trocar o técnico." };
    return { error: `Não foi possível trocar o técnico (${error.message}).` };
  }

  revalidatePath("/rotas/confirmadas");
  revalidatePath("/servicos-do-dia");
  return { error: null };
}
