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

// ---------------------------------------------------------------------------
// Editar paradas de uma rota confirmada (migration 0062, 18/09/2026):
// adicionar uma RT (com técnico e chamados escolhidos) ou remover uma RT.
// Toda a regra — rota confirmada e não passada, RT já na rota, técnico da
// equipe, elegibilidade dos chamados, parada já iniciada, última RT — vive
// nas funções do banco; aqui só se traduz o erro.
// ---------------------------------------------------------------------------

export type ChamadoElegivel = {
  id: string;
  assunto: string;
  protocolo: string | null;
  prioridade: string;
  criadoEm: string;
};

/** Chamados da RT que entrariam num serviço novo: não encerrados e sem serviço ativo. */
export async function listarChamadosElegiveis(rtId: string): Promise<{
  chamados: ChamadoElegivel[];
  error: string | null;
}> {
  if (!rtId) return { chamados: [], error: "RT inválida." };
  const supabase = await createClient();
  const [{ data: chamados, error: e1 }, { data: ativos, error: e2 }] = await Promise.all([
    supabase
      .from("chamados")
      .select("id, assunto, tomticket_id, prioridade, criado_em")
      .eq("rt_id", rtId)
      .not("status", "in", "(finalizado,cancelado)")
      .order("criado_em", { ascending: false }),
    supabase.from("servicos").select("chamado_id").eq("rt_id", rtId).neq("status", "cancelado"),
  ]);
  if (e1 || e2) return { chamados: [], error: e1?.message ?? e2?.message ?? "Erro ao buscar chamados." };
  const comServico = new Set((ativos ?? []).map((s) => s.chamado_id as string));
  return {
    error: null,
    chamados: (chamados ?? [])
      .filter((c) => !comServico.has(c.id as string))
      .map((c) => ({
        id: c.id as string,
        assunto: c.assunto as string,
        protocolo: (c.tomticket_id as string | null) ?? null,
        prioridade: c.prioridade as string,
        criadoEm: c.criado_em as string,
      })),
  };
}

export async function adicionarParadaRota(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rotaId = String(formData.get("rotaId") ?? "");
  const rtId = String(formData.get("rtId") ?? "");
  const tecnicoId = String(formData.get("tecnicoId") ?? "");
  const categoria = String(formData.get("categoria") ?? "concluir_hoje");
  const chamadoIds = formData.getAll("chamadoIds").map(String).filter(Boolean);
  if (!rotaId) return { error: "Rota inválida." };
  if (!rtId) return { error: "Escolha a RT." };
  if (!tecnicoId) return { error: "Escolha o técnico responsável." };
  if (chamadoIds.length === 0) return { error: "Marque pelo menos um chamado pra atender." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_adicionar_parada_rota", {
    p_rota_id: rotaId,
    p_rt_id: rtId,
    p_tecnico_id: tecnicoId,
    p_chamado_ids: chamadoIds,
    p_categoria: categoria,
  });
  if (error) {
    if (error.code === "P0001") return { error: error.message };
    if (error.code === "42501") return { error: "Você não tem permissão pra editar as paradas." };
    if (error.code === "PGRST202")
      return { error: "A função fn_adicionar_parada_rota não existe no banco — rode a migration 0062." };
    return { error: `Não foi possível adicionar a parada (${error.message}).` };
  }

  revalidatePath("/rotas/confirmadas");
  revalidatePath("/servicos-do-dia");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function removerParadaRota(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const rotaId = String(formData.get("rotaId") ?? "");
  const rtId = String(formData.get("rtId") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!rotaId || !rtId) return { error: "Parada inválida." };
  if (!motivo) return { error: "Informe o motivo da remoção." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_remover_parada_rota", {
    p_rota_id: rotaId,
    p_rt_id: rtId,
    p_motivo: motivo,
  });
  if (error) {
    if (error.code === "P0001") return { error: error.message };
    if (error.code === "42501") return { error: "Você não tem permissão pra editar as paradas." };
    if (error.code === "PGRST202")
      return { error: "A função fn_remover_parada_rota não existe no banco — rode a migration 0062." };
    return { error: `Não foi possível remover a parada (${error.message}).` };
  }

  revalidatePath("/rotas/confirmadas");
  revalidatePath("/servicos-do-dia");
  revalidatePath("/dashboard");
  return { error: null };
}
