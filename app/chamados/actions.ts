"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

function traduzErro(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return "Já existe um chamado com esse número de protocolo (TomTicket).";
  }
  if (error.code === "23503") {
    return "A RT selecionada não existe mais — atualize a página e tente de novo.";
  }
  if (error.code === "42501") {
    return "Você não tem permissão pra fazer essa alteração.";
  }
  return `Não foi possível salvar (${error.message}).`;
}

export async function criarChamado(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rtId = String(formData.get("rtId") ?? "");
  const assunto = String(formData.get("assunto") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const prioridade = String(formData.get("prioridade") ?? "");
  const tomticketId = String(formData.get("tomticketId") ?? "").trim();

  if (!rtId) return { error: "Selecione a RT." };
  if (!assunto) return { error: "Informe o assunto." };
  if (!prioridade) return { error: "Selecione a prioridade." };

  const supabase = await createClient();
  const { error } = await supabase.from("chamados").insert({
    rt_id: rtId,
    assunto,
    descricao: descricao || null,
    prioridade,
    tomticket_id: tomticketId || null,
  });
  if (error) return { error: traduzErro(error) };

  revalidatePath("/chamados");
  return { error: null };
}
