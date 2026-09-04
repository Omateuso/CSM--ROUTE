"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

function traduzErro(error: { code?: string; message: string }): string {
  // P0001 = `raise exception` dentro de fn_iniciar_servico/fn_concluir_servico
  // (migration 0014, ajustada na 0023) — a mensagem já vem pronta em português.
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Você não tem permissão pra essa ação.";
  return `Não foi possível concluir a ação (${error.message}).`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function parseCoord(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Pacote 2 da auditoria de segurança (migration 0024, 21/08/2026): hash de
// cada evidência calculado no servidor — o arquivo já chega aqui via
// FormData, então dá pra usar o `crypto` nativo do Node em vez de
// `crypto.subtle` no client. Usado pra detectar OS reaproveitada entre
// serviços diferentes (comparação fica na tela de validação do gerente).
async function hashArquivo(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return createHash("sha256").update(buffer).digest("hex");
}

// Migration 0023 (auditoria de segurança, 21/08/2026): iniciar atendimento
// passou a exigir foto "antes" (câmera + geolocalização, ver
// camera-capture-field.tsx) — sobe a evidência primeiro, só then chama
// fn_iniciar_servico, que revalida de novo no servidor se a foto existe
// antes de liberar a transição pra em_execucao.
export async function iniciarServico(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const servicoId = String(formData.get("servicoId") ?? "");
  if (!servicoId) return { error: "Serviço inválido." };

  const fotoEntry = formData.get("fotoAntes");
  const foto = fotoEntry instanceof File && fotoEntry.size > 0 ? fotoEntry : null;
  if (!foto) return { error: "Tire a foto de antes do atendimento." };

  const latitude = parseCoord(formData.get("fotoAntesLat"));
  const longitude = parseCoord(formData.get("fotoAntesLng"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada — faça login de novo." };

  const path = `${servicoId}/foto-antes-${Date.now()}-${sanitizeFileName(foto.name)}`;
  const { error: uploadError } = await supabase.storage.from("evidencias").upload(path, foto);
  if (uploadError) return { error: `Falha ao enviar a foto (${uploadError.message}).` };

  const { error: insertError } = await supabase.from("evidencias").insert({
    servico_id: servicoId,
    tipo: "foto",
    momento: "antes",
    storage_path: path,
    latitude,
    longitude,
    hash_arquivo: await hashArquivo(foto),
    criado_por: user.id,
  });
  if (insertError) return { error: `Falha ao registrar a foto (${insertError.message}).` };

  const { error } = await supabase.rpc("fn_iniciar_servico", { p_servico_id: servicoId });
  if (error) return { error: traduzErro(error) };

  revalidatePath(`/servico/${servicoId}`);
  revalidatePath("/servicos-do-dia");
  return { error: null };
}

// Upload das evidências + fn_concluir_servico numa ação só: o técnico
// preenche observação, anexa a OS (obrigatória) e a foto de depois
// (obrigatória de novo desde a 0023 — câmera + geolocalização), e um único
// toque em "Concluir" faz tudo — menos telas/toques no celular (persona
// técnico, CLAUDE.md). fn_concluir_servico revalida de novo no servidor se
// a OS e a foto realmente existem antes de fechar o status (defesa em
// profundidade, não só confia na checagem feita aqui).
export async function concluirServico(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const servicoId = String(formData.get("servicoId") ?? "");
  const observacao = String(formData.get("observacao") ?? "").trim();
  if (!servicoId) return { error: "Serviço inválido." };
  if (!observacao) return { error: "Descreva o que foi feito antes de concluir." };

  const fotoEntry = formData.get("fotoDepois");
  const foto = fotoEntry instanceof File && fotoEntry.size > 0 ? fotoEntry : null;
  if (!foto) return { error: "Tire a foto de depois do atendimento." };

  const latitude = parseCoord(formData.get("fotoDepoisLat"));
  const longitude = parseCoord(formData.get("fotoDepoisLng"));

  const osEntry = formData.get("os");
  const os = osEntry instanceof File && osEntry.size > 0 ? osEntry : null;
  if (!os) return { error: "Anexe a OS (foto ou PDF)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada — faça login de novo." };

  const fotoPath = `${servicoId}/foto-depois-${Date.now()}-${sanitizeFileName(foto.name)}`;
  const { error: fotoUploadError } = await supabase.storage.from("evidencias").upload(fotoPath, foto);
  if (fotoUploadError) return { error: `Falha ao enviar a foto (${fotoUploadError.message}).` };
  const { error: fotoInsertError } = await supabase.from("evidencias").insert({
    servico_id: servicoId,
    tipo: "foto",
    momento: "depois",
    storage_path: fotoPath,
    latitude,
    longitude,
    hash_arquivo: await hashArquivo(foto),
    criado_por: user.id,
  });
  if (fotoInsertError) return { error: `Falha ao registrar a foto (${fotoInsertError.message}).` };

  const osPath = `${servicoId}/os-${Date.now()}-${sanitizeFileName(os.name)}`;
  const { error: osUploadError } = await supabase.storage.from("evidencias").upload(osPath, os);
  if (osUploadError) return { error: `Falha ao enviar a OS (${osUploadError.message}).` };
  const { error: osInsertError } = await supabase.from("evidencias").insert({
    servico_id: servicoId,
    tipo: "os",
    storage_path: osPath,
    hash_arquivo: await hashArquivo(os),
    criado_por: user.id,
  });
  if (osInsertError) return { error: `Falha ao registrar a OS (${osInsertError.message}).` };

  const { error: concluirError } = await supabase.rpc("fn_concluir_servico", {
    p_servico_id: servicoId,
    p_observacao: observacao,
  });
  if (concluirError) return { error: traduzErro(concluirError) };

  revalidatePath(`/servico/${servicoId}`);
  revalidatePath("/servicos-do-dia");
  return { error: null };
}

// Migration 0026 (generalização, 22/08/2026): técnico não conseguiu
// terminar o atendimento — motivo pode ser falta de material, mas também
// espera por decisão da gestão, equipamento em análise, etc. (categoria
// fechada + descrição livre). Passou a exigir a OS também, além da foto do
// parcial — o técnico preenche a OS mesmo quando não conclui (documenta
// pro TomTicket de qualquer forma). Sobe as duas evidências primeiro
// (mesmo padrão sequencial das outras actions), só then chama
// fn_reportar_pendencia, que cancela o serviço e libera o chamado pra
// próxima rota.
export async function reportarPendencia(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const servicoId = String(formData.get("servicoId") ?? "");
  const categoria = String(formData.get("categoria") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  if (!servicoId) return { error: "Serviço inválido." };
  if (!categoria) return { error: "Selecione o tipo de pendência." };
  if (!descricao) return { error: "Descreva o que já foi feito e o motivo da pendência." };

  const fotoEntry = formData.get("fotoParcial");
  const foto = fotoEntry instanceof File && fotoEntry.size > 0 ? fotoEntry : null;
  if (!foto) return { error: "Tire uma foto do que já foi feito." };

  const latitude = parseCoord(formData.get("fotoParcialLat"));
  const longitude = parseCoord(formData.get("fotoParcialLng"));

  const osEntry = formData.get("os");
  const os = osEntry instanceof File && osEntry.size > 0 ? osEntry : null;
  if (!os) return { error: "Anexe a OS (foto ou PDF)." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada — faça login de novo." };

  const path = `${servicoId}/foto-parcial-${Date.now()}-${sanitizeFileName(foto.name)}`;
  const { error: uploadError } = await supabase.storage.from("evidencias").upload(path, foto);
  if (uploadError) return { error: `Falha ao enviar a foto (${uploadError.message}).` };

  const { error: insertError } = await supabase.from("evidencias").insert({
    servico_id: servicoId,
    tipo: "foto",
    momento: "parcial",
    storage_path: path,
    latitude,
    longitude,
    hash_arquivo: await hashArquivo(foto),
    criado_por: user.id,
  });
  if (insertError) return { error: `Falha ao registrar a foto (${insertError.message}).` };

  const osPath = `${servicoId}/os-${Date.now()}-${sanitizeFileName(os.name)}`;
  const { error: osUploadError } = await supabase.storage.from("evidencias").upload(osPath, os);
  if (osUploadError) return { error: `Falha ao enviar a OS (${osUploadError.message}).` };
  const { error: osInsertError } = await supabase.from("evidencias").insert({
    servico_id: servicoId,
    tipo: "os",
    storage_path: osPath,
    hash_arquivo: await hashArquivo(os),
    criado_por: user.id,
  });
  if (osInsertError) return { error: `Falha ao registrar a OS (${osInsertError.message}).` };

  const { error } = await supabase.rpc("fn_reportar_pendencia", {
    p_servico_id: servicoId,
    p_categoria: categoria,
    p_descricao: descricao,
  });
  if (error) return { error: traduzErro(error) };

  revalidatePath(`/servico/${servicoId}`);
  revalidatePath("/servicos-do-dia");
  return { error: null };
}
