"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

function traduzErro(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return "Já existe uma RT com esse código.";
  }
  if (error.code === "23503") {
    return "A região ou o CAPS selecionado não existe mais — atualize a página e tente de novo.";
  }
  if (error.code === "42501") {
    return "Você não tem permissão pra fazer essa alteração.";
  }
  return `Não foi possível salvar (${error.message}).`;
}

// Toda RT nasce já com sua primeira linha em rt_enderecos — nunca um
// insert direto em `rts` (ver CLAUDE.md, "Endereço de RT tem histórico").
export async function criarRT(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const codigo = String(formData.get("codigo") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const endereco = String(formData.get("endereco") ?? "").trim();
  const bairro = String(formData.get("bairro") ?? "").trim();
  const regiaoId = String(formData.get("regiaoId") ?? "");
  const capsId = String(formData.get("capsId") ?? "");
  const latitude = Number(String(formData.get("latitude") ?? "").replace(",", "."));
  const longitude = Number(String(formData.get("longitude") ?? "").replace(",", "."));
  const ativo = formData.get("ativo") === "on";

  if (!codigo) return { error: "Informe o código da RT." };
  if (!nome) return { error: "Informe o nome da RT." };
  if (!endereco) return { error: "Informe o endereço." };
  if (!bairro) return { error: "Informe o bairro." };
  if (!regiaoId) return { error: "Selecione a região." };
  if (!capsId) return { error: "Selecione o CAPS." };
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return { error: "Latitude inválida." };
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { error: "Longitude inválida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_criar_rt_com_endereco", {
    p_codigo: codigo,
    p_nome: nome,
    p_endereco: endereco,
    p_bairro: bairro,
    p_regiao_id: regiaoId,
    p_caps_id: capsId,
    p_latitude: latitude,
    p_longitude: longitude,
    p_ativo: ativo,
  });
  if (error) return { error: traduzErro(error) };

  revalidatePath("/rts");
  return { error: null };
}

// Nome/ativo/CAPS — o código é a identidade permanente da RT (não muda
// depois de criada) e o endereço só muda via trocarEnderecoRT. CAPS não
// tem histórico (diferente do endereço): é só um update normal.
export async function editarRT(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const capsId = String(formData.get("capsId") ?? "");
  const ativo = formData.get("ativo") === "on";

  if (!nome) return { error: "Informe o nome da RT." };
  if (!capsId) return { error: "Selecione o CAPS." };

  const supabase = await createClient();
  const { error } = await supabase.from("rts").update({ nome, ativo, caps_id: capsId }).eq("id", id);
  if (error) return { error: traduzErro(error) };

  revalidatePath("/rts");
  return { error: null };
}

// Único jeito suportado de mudar endereço/bairro/região/lat/long de uma
// RT — fecha o endereço vigente em rt_enderecos, abre o novo, sincroniza
// rts. Nunca um update direto nessas colunas (ver CLAUDE.md).
export async function trocarEnderecoRT(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const endereco = String(formData.get("endereco") ?? "").trim();
  const bairro = String(formData.get("bairro") ?? "").trim();
  const regiaoId = String(formData.get("regiaoId") ?? "");
  const latitude = Number(String(formData.get("latitude") ?? "").replace(",", "."));
  const longitude = Number(String(formData.get("longitude") ?? "").replace(",", "."));
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (!endereco) return { error: "Informe o endereço." };
  if (!bairro) return { error: "Informe o bairro." };
  if (!regiaoId) return { error: "Selecione a região." };
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return { error: "Latitude inválida." };
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return { error: "Longitude inválida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_trocar_endereco_rt", {
    p_rt_id: id,
    p_endereco: endereco,
    p_bairro: bairro,
    p_regiao_id: regiaoId,
    p_latitude: latitude,
    p_longitude: longitude,
    p_motivo: motivo || null,
  });
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
