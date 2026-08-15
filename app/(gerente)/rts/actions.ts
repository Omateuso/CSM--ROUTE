"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

function traduzErro(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return "Já existe uma RT com esse código.";
  }
  if (error.code === "23503") {
    return "A região selecionada não existe mais — atualize a página e tente de novo.";
  }
  if (error.code === "42501") {
    return "Você não tem permissão pra fazer essa alteração.";
  }
  return `Não foi possível salvar (${error.message}).`;
}

function lerCamposRT(formData: FormData) {
  const latitude = Number(String(formData.get("latitude") ?? "").replace(",", "."));
  const longitude = Number(String(formData.get("longitude") ?? "").replace(",", "."));

  return {
    codigo: String(formData.get("codigo") ?? "").trim(),
    nome: String(formData.get("nome") ?? "").trim(),
    endereco: String(formData.get("endereco") ?? "").trim(),
    bairro: String(formData.get("bairro") ?? "").trim(),
    regiao_id: String(formData.get("regiaoId") ?? ""),
    latitude,
    longitude,
    ativo: formData.get("ativo") === "on",
  };
}

function validarCamposRT(campos: ReturnType<typeof lerCamposRT>): string | null {
  if (!campos.codigo) return "Informe o código da RT.";
  if (!campos.nome) return "Informe o nome da RT.";
  if (!campos.endereco) return "Informe o endereço.";
  if (!campos.bairro) return "Informe o bairro.";
  if (!campos.regiao_id) return "Selecione a região.";
  if (!Number.isFinite(campos.latitude) || campos.latitude < -90 || campos.latitude > 90) {
    return "Latitude inválida.";
  }
  if (!Number.isFinite(campos.longitude) || campos.longitude < -180 || campos.longitude > 180) {
    return "Longitude inválida.";
  }
  return null;
}

export async function criarRT(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const campos = lerCamposRT(formData);
  const erroValidacao = validarCamposRT(campos);
  if (erroValidacao) return { error: erroValidacao };

  const supabase = await createClient();
  const { error } = await supabase.from("rts").insert(campos);
  if (error) return { error: traduzErro(error) };

  revalidatePath("/rts");
  return { error: null };
}

export async function atualizarRT(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const campos = lerCamposRT(formData);
  const erroValidacao = validarCamposRT(campos);
  if (erroValidacao) return { error: erroValidacao };

  const supabase = await createClient();
  const { error } = await supabase.from("rts").update(campos).eq("id", id);
  if (error) return { error: traduzErro(error) };

  revalidatePath("/rts");
  return { error: null };
}

export async function alternarAtivo(id: string, novoValor: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("rts").update({ ativo: novoValor }).eq("id", id);
  if (error) return { error: traduzErro(error) };

  revalidatePath("/rts");
  return { error: null };
}
