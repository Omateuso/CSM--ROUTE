"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

// O número é o rótulo que aparece no pino do técnico no mapa da Rota do
// dia (migration 0040) — precisa ser inteiro positivo, e a unicidade é
// garantida por constraint no banco, não só aqui.
function lerNumero(formData: FormData): number | null {
  const bruto = String(formData.get("numero") ?? "").trim();
  if (!bruto) return null;
  const n = Number(bruto);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function traduzErro(error: { code?: string; message: string }): string {
  if (error.code === "23503") {
    return "A zona selecionada não existe mais — atualize a página e tente de novo.";
  }
  if (error.code === "23505") {
    return "Já existe uma equipe com esse número. Escolha outro.";
  }
  if (error.code === "42501") {
    return "Você não tem permissão pra fazer essa alteração.";
  }
  return `Não foi possível salvar (${error.message}).`;
}

export async function criarEquipe(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const nome = String(formData.get("nome") ?? "").trim();
  const numero = lerNumero(formData);
  const zonaPadraoId = String(formData.get("zonaPadraoId") ?? "");
  const responsavelId = String(formData.get("responsavelId") ?? "");

  if (!nome) return { error: "Informe o nome da equipe." };
  if (numero == null) return { error: "Informe o número da equipe (inteiro maior que zero)." };

  const supabase = await createClient();
  const { error } = await supabase.from("equipes").insert({
    nome,
    numero,
    zona_padrao_id: zonaPadraoId || null,
    responsavel_id: responsavelId || null,
  });
  if (error) return { error: traduzErro(error) };

  revalidatePath("/equipes");
  return { error: null };
}

export async function editarEquipe(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const zonaPadraoId = String(formData.get("zonaPadraoId") ?? "");
  const responsavelId = String(formData.get("responsavelId") ?? "");
  const ativo = formData.get("ativo") === "on";
  const numero = lerNumero(formData);

  if (!nome) return { error: "Informe o nome da equipe." };
  if (numero == null) return { error: "Informe o número da equipe (inteiro maior que zero)." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("equipes")
    .update({
      nome,
      numero,
      zona_padrao_id: zonaPadraoId || null,
      responsavel_id: responsavelId || null,
      ativo,
    })
    .eq("id", id);
  if (error) return { error: traduzErro(error) };

  revalidatePath("/equipes");
  return { error: null };
}

export async function alternarAtivoEquipe(id: string, novoValor: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("equipes").update({ ativo: novoValor }).eq("id", id);
  if (error) return { error: traduzErro(error) };

  revalidatePath("/equipes");
  return { error: null };
}

// Único jeito de mexer no profile de um técnico por aqui — a policy
// profiles_update_tecnico_by_gerente (migration 0010) só deixa o gerente
// tocar em linhas com role = 'tecnico', e só essas duas colunas importam
// pro fluxo de equipes.
export async function atualizarEquipeTecnico(tecnicoId: string, equipeId: string | null): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ equipe_id: equipeId })
    .eq("id", tecnicoId);
  if (error) return { error: traduzErro(error) };

  revalidatePath("/equipes");
  return { error: null };
}

export async function alternarAtivoTecnico(tecnicoId: string, novoValor: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ativo: novoValor })
    .eq("id", tecnicoId);
  if (error) return { error: traduzErro(error) };

  revalidatePath("/equipes");
  return { error: null };
}
