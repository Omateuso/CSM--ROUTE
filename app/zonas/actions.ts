"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

// A UI já restringe quem enxerga o formulário (ver page.tsx), mas quem
// garante a regra de negócio de verdade é a RLS (policies *_gerente da
// migration 0002) — este mapeamento só traduz o que o Postgres já bloqueou
// em mensagem legível.
function traduzErro(error: { code?: string; message: string }, contexto: "zona" | "regiao", operacao: "criar" | "excluir"): string {
  if (error.code === "23505") {
    return contexto === "zona"
      ? "Já existe uma zona com esse nome."
      : "Essa região já existe nessa zona.";
  }
  if (error.code === "23503" && operacao === "excluir") {
    return contexto === "zona"
      ? "Essa zona ainda tem regiões cadastradas — remova as regiões primeiro."
      : "Essa região ainda tem RTs vinculadas — mova ou remova as RTs primeiro.";
  }
  if (error.code === "42501") {
    return "Você não tem permissão pra fazer essa alteração.";
  }
  return `Não foi possível completar a ação (${error.message}).`;
}

export async function criarZona(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Informe o nome da zona." };

  const supabase = await createClient();
  const { error } = await supabase.from("zonas").insert({ nome });
  if (error) return { error: traduzErro(error, "zona", "criar") };

  revalidatePath("/zonas");
  return { error: null };
}

export async function renomearZona(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Informe o nome da zona." };

  const supabase = await createClient();
  const { error } = await supabase.from("zonas").update({ nome }).eq("id", id);
  if (error) return { error: traduzErro(error, "zona", "criar") };

  revalidatePath("/zonas");
  return { error: null };
}

export async function excluirZona(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("zonas").delete().eq("id", id);
  if (error) return { error: traduzErro(error, "zona", "excluir") };

  revalidatePath("/zonas");
  return { error: null };
}

export async function criarRegiao(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const zonaId = String(formData.get("zonaId") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Informe o nome da região." };

  const supabase = await createClient();
  const { error } = await supabase.from("regioes").insert({ zona_id: zonaId, nome });
  if (error) return { error: traduzErro(error, "regiao", "criar") };

  revalidatePath("/zonas");
  return { error: null };
}

export async function renomearRegiao(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { error: "Informe o nome da região." };

  const supabase = await createClient();
  const { error } = await supabase.from("regioes").update({ nome }).eq("id", id);
  if (error) return { error: traduzErro(error, "regiao", "criar") };

  revalidatePath("/zonas");
  return { error: null };
}

export async function excluirRegiao(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("regioes").delete().eq("id", id);
  if (error) return { error: traduzErro(error, "regiao", "excluir") };

  revalidatePath("/zonas");
  return { error: null };
}
