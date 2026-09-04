"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null; urgenciaId?: string };

function traduzErro(error: { code?: string; message: string }): string {
  // P0001 = `raise exception` dentro das funções de urgência (migration
  // 0027) — a mensagem já vem pronta em português.
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Você não tem permissão pra essa ação.";
  return `Não foi possível concluir a ação (${error.message}).`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

// Registra a urgência (fn_registrar_urgencia). O anexo (opcional) só pode
// subir DEPOIS — o path convencionado é "{urgencia_id}/anexo-...", e o id
// só existe depois do insert — mesmo raciocínio de "não dá pra montar o
// path antes do registro existir", mas aqui sem servico_id de por meio
// (diferente de evidencias). Falha no upload do anexo não derruba o
// registro da urgência, que já está feito e é o que importa.
export async function registrarUrgencia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rtId = String(formData.get("rtId") ?? "");
  const descricao = String(formData.get("descricao") ?? "").trim();
  const motivo = String(formData.get("motivo") ?? "").trim();
  const solicitante = String(formData.get("solicitante") ?? "").trim();
  const tomticketId = String(formData.get("tomticketId") ?? "").trim();
  const prioridadeRaw = String(formData.get("prioridade") ?? "").trim();
  const prioridade = prioridadeRaw === "" ? null : prioridadeRaw;

  if (!rtId) return { error: "Selecione a RT da urgência." };
  if (!descricao) return { error: "Descreva a urgência." };
  if (!motivo) return { error: "Informe o motivo da urgência." };
  if (!solicitante) return { error: "Informe quem solicitou." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada — faça login de novo." };

  // Se o protocolo já foi informado e já existe um chamado real com ele
  // (import diário, por exemplo), vincula direto — evita duplicar quando o
  // gerente já sabe o número (item 8 do spec original: "vincular e evitar
  // duplicação").
  let chamadoId: string | null = null;
  if (tomticketId) {
    const { data: chamadoExistente } = await supabase
      .from("chamados")
      .select("id")
      .eq("tomticket_id", tomticketId)
      .maybeSingle();
    chamadoId = (chamadoExistente?.id as string | undefined) ?? null;
  }

  const { data: urgenciaId, error } = await supabase.rpc("fn_registrar_urgencia", {
    p_rt_id: rtId,
    p_chamado_id: chamadoId,
    p_descricao: descricao,
    p_motivo: motivo,
    p_solicitante: solicitante,
    p_prioridade: prioridade,
    p_anexo_path: null,
  });
  if (error) return { error: traduzErro(error) };

  const anexoEntry = formData.get("anexo");
  const anexo = anexoEntry instanceof File && anexoEntry.size > 0 ? anexoEntry : null;
  if (anexo) {
    const path = `${urgenciaId}/anexo-${Date.now()}-${sanitizeFileName(anexo.name)}`;
    const { error: uploadError } = await supabase.storage.from("urgencias-anexos").upload(path, anexo);
    if (!uploadError) {
      await supabase.from("urgencias").update({ anexo_path: path }).eq("id", urgenciaId as string);
    }
  }

  revalidatePath("/urgencias");
  return { error: null, urgenciaId: urgenciaId as string };
}

export async function analisarUrgencia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const urgenciaId = String(formData.get("urgenciaId") ?? "");
  if (!urgenciaId) return { error: "Urgência inválida." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_analisar_urgencia", { p_urgencia_id: urgenciaId });
  if (error) return { error: traduzErro(error) };

  revalidatePath("/urgencias");
  revalidatePath(`/urgencias/${urgenciaId}`);
  return { error: null };
}

export async function validarUrgencia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const urgenciaId = String(formData.get("urgenciaId") ?? "");
  const prioridade = String(formData.get("prioridade") ?? "");
  if (!urgenciaId) return { error: "Urgência inválida." };
  if (!prioridade) return { error: "Selecione a prioridade." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_validar_urgencia", {
    p_urgencia_id: urgenciaId,
    p_prioridade: prioridade,
  });
  if (error) return { error: traduzErro(error) };

  revalidatePath("/urgencias");
  revalidatePath(`/urgencias/${urgenciaId}`);
  return { error: null };
}

export async function invalidarUrgencia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const urgenciaId = String(formData.get("urgenciaId") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!urgenciaId) return { error: "Urgência inválida." };
  if (!motivo) return { error: "Informe o motivo." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_invalidar_urgencia", {
    p_urgencia_id: urgenciaId,
    p_motivo: motivo,
  });
  if (error) return { error: traduzErro(error) };

  revalidatePath("/urgencias");
  revalidatePath(`/urgencias/${urgenciaId}`);
  return { error: null };
}

export async function cancelarUrgencia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const urgenciaId = String(formData.get("urgenciaId") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!urgenciaId) return { error: "Urgência inválida." };
  if (!motivo) return { error: "Informe o motivo do cancelamento." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cancelar_urgencia", {
    p_urgencia_id: urgenciaId,
    p_motivo: motivo,
  });
  if (error) return { error: traduzErro(error) };

  revalidatePath("/urgencias");
  revalidatePath(`/urgencias/${urgenciaId}`);
  return { error: null };
}

// Cria (se preciso) o chamado real + insere a parada/rota + cria o serviço
// — a partir daqui é o pipeline de execução já existente, sem nenhum código
// novo (fn_decidir_atendimento_urgencia, migration 0027).
export async function decidirAtendimento(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const urgenciaId = String(formData.get("urgenciaId") ?? "");
  const opcao = String(formData.get("opcao") ?? "");
  const rotaId = String(formData.get("rotaId") ?? "") || null;
  const equipeId = String(formData.get("equipeId") ?? "");
  const tecnicoId = String(formData.get("tecnicoId") ?? "");
  const impactoKmRaw = String(formData.get("impactoKm") ?? "");
  const impactoMinRaw = String(formData.get("impactoMin") ?? "");

  if (!urgenciaId) return { error: "Urgência inválida." };
  if (!opcao) return { error: "Selecione como atender a urgência." };
  if (!equipeId || !tecnicoId) return { error: "Selecione a equipe e o técnico responsável." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_decidir_atendimento_urgencia", {
    p_urgencia_id: urgenciaId,
    p_opcao: opcao,
    p_rota_id: rotaId,
    p_equipe_id: equipeId,
    p_tecnico_id: tecnicoId,
    p_impacto_km: impactoKmRaw ? Number(impactoKmRaw) : null,
    p_impacto_min: impactoMinRaw ? Number(impactoMinRaw) : null,
  });
  if (error) return { error: traduzErro(error) };

  revalidatePath("/urgencias");
  revalidatePath(`/urgencias/${urgenciaId}`);
  revalidatePath("/dashboard");
  return { error: null };
}

export async function vincularTomticket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const urgenciaId = String(formData.get("urgenciaId") ?? "");
  const tomticketId = String(formData.get("tomticketId") ?? "").trim();
  if (!urgenciaId) return { error: "Urgência inválida." };
  if (!tomticketId) return { error: "Informe o protocolo." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_vincular_urgencia_tomticket", {
    p_urgencia_id: urgenciaId,
    p_tomticket_id: tomticketId,
  });
  if (error) return { error: traduzErro(error) };

  revalidatePath(`/urgencias/${urgenciaId}`);
  return { error: null };
}
