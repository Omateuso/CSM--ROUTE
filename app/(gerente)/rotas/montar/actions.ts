"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Prioridade } from "@/app/chamados/prioridade-badge";

export type ActionState = { error: string | null; rotaId?: string };

function traduzErro(error: { code?: string; message: string }): string {
  if (error.code === "23503") {
    return "A equipe ou alguma RT selecionada não existe mais — atualize a página e tente de novo.";
  }
  if (error.code === "42501") {
    return "Você não tem permissão pra confirmar rotas.";
  }
  // P0001 = `raise exception` dentro de fn_confirmar_rota — a mensagem já
  // vem pronta em português (ex.: "Selecione um técnico para todas as RTs").
  if (error.code === "P0001") {
    return error.message;
  }
  return `Não foi possível confirmar a rota (${error.message}).`;
}

// -----------------------------------------------------------------------------
// Categorização por chamado — "concluir hoje" vs "revisão técnica" (pedido do
// usuário, 11/09/2026, migration 0046). Busca os chamados elegíveis de cada RT
// pra alimentar o checklist do diálogo de confirmação — MESMA regra de
// elegibilidade que `fn_confirmar_rota` usa no servidor (status ainda não
// fechado no TomTicket + sem serviço ativo já criado); se as duas listas
// divergirem por uma corrida rara (chamado fechado entre a busca e o clique em
// "Confirmar"), a função do banco é quem decide de fato — isto aqui só
// alimenta a tela.
// -----------------------------------------------------------------------------
export type ChamadoElegivel = {
  id: string;
  rtId: string;
  tomticketId: string | null;
  assunto: string;
  prioridade: Prioridade;
};

export async function buscarChamadosElegiveis(rtIds: string[]): Promise<ChamadoElegivel[]> {
  if (rtIds.length === 0) return [];

  const supabase = await createClient();

  const { data: chamadosRaw, error } = await supabase
    .from("chamados")
    .select("id, rt_id, tomticket_id, assunto, prioridade")
    .in("rt_id", rtIds)
    .not("status", "in", "(finalizado,cancelado)")
    .order("criado_em", { ascending: true });

  if (error || !chamadosRaw || chamadosRaw.length === 0) return [];

  const chamadoIds = chamadosRaw.map((c) => c.id as string);
  const { data: servicosAtivosRaw } = await supabase
    .from("servicos")
    .select("chamado_id")
    .in("chamado_id", chamadoIds)
    .neq("status", "cancelado");

  const comServicoAtivo = new Set((servicosAtivosRaw ?? []).map((s) => s.chamado_id as string));

  return chamadosRaw
    .filter((c) => !comServicoAtivo.has(c.id as string))
    .map((c) => ({
      id: c.id as string,
      rtId: c.rt_id as string,
      tomticketId: (c.tomticket_id as string | null) ?? null,
      assunto: c.assunto as string,
      prioridade: c.prioridade as Prioridade,
    }));
}

// Grava rotas + rota_rts numa transação só via fn_confirmar_rota (migration
// 0011) — nunca dois inserts separados aqui, senão uma falha no segundo
// deixaria uma `rotas` órfã sem nenhuma RT.
export async function confirmarRota(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const data = String(formData.get("data") ?? "");
  const equipeId = String(formData.get("equipeId") ?? "");
  const rtIdsRaw = String(formData.get("rtIds") ?? "");
  const tecnicoIdsRaw = String(formData.get("tecnicoIds") ?? "");
  // Presente = o gerente teve a chance de categorizar (o diálogo carregou os
  // chamados elegíveis); ausente = a busca falhou e o diálogo confirmou sem
  // categorização, comportamento de sempre (tudo concluir_hoje) — ver
  // ConfirmarRotaDialog.
  const chamadosDiaRaw = formData.get("chamadosDia");
  // Mais de um atendente por parada (migration 0050, 14/09/2026) —
  // {"<rtId>": ["<tecnicoId>", ...]}, só as RTs que ganharam algum extra.
  const tecnicosExtraRaw = formData.get("tecnicosExtra");

  if (!data) return { error: "Selecione a data da rota." };
  if (!equipeId) return { error: "Selecione a equipe." };

  let rtIds: unknown;
  try {
    rtIds = JSON.parse(rtIdsRaw);
  } catch {
    return { error: "Lista de RTs inválida." };
  }
  if (!Array.isArray(rtIds) || rtIds.length === 0 || !rtIds.every((v) => typeof v === "string")) {
    return { error: "Adicione pelo menos uma RT à rota antes de confirmar." };
  }

  let tecnicoIds: unknown;
  try {
    tecnicoIds = JSON.parse(tecnicoIdsRaw);
  } catch {
    return { error: "Lista de técnicos inválida." };
  }
  if (
    !Array.isArray(tecnicoIds) ||
    tecnicoIds.length !== rtIds.length ||
    !tecnicoIds.every((v) => typeof v === "string" && v.length > 0)
  ) {
    return { error: "Escolha um técnico responsável para cada RT da rota." };
  }

  let chamadosDia: string[] | null = null;
  if (typeof chamadosDiaRaw === "string" && chamadosDiaRaw.length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(chamadosDiaRaw);
    } catch {
      return { error: "Seleção de chamados do dia inválida." };
    }
    if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) {
      return { error: "Seleção de chamados do dia inválida." };
    }
    chamadosDia = parsed;
  }

  // Só vira `p_tecnicos_extra` quando de fato veio algo — vazio ou ausente
  // caem em `null`, que é exatamente "nenhuma RT tem técnico extra"
  // (fn_confirmar_rota trata os dois casos do mesmo jeito).
  let tecnicosExtra: Record<string, string[]> | null = null;
  if (typeof tecnicosExtraRaw === "string" && tecnicosExtraRaw.length > 0) {
    let parsedExtra: unknown;
    try {
      parsedExtra = JSON.parse(tecnicosExtraRaw);
    } catch {
      return { error: "Seleção de técnicos extras inválida." };
    }
    if (
      typeof parsedExtra !== "object" ||
      parsedExtra === null ||
      Array.isArray(parsedExtra) ||
      !Object.entries(parsedExtra as Record<string, unknown>).every(
        ([rtId, ids]) =>
          typeof rtId === "string" &&
          Array.isArray(ids) &&
          ids.every((v) => typeof v === "string" && v.length > 0),
      )
    ) {
      return { error: "Seleção de técnicos extras inválida." };
    }
    const objeto = parsedExtra as Record<string, string[]>;
    if (Object.keys(objeto).length > 0) tecnicosExtra = objeto;
  }

  const supabase = await createClient();

  // `p_chamados_dia` NULL = todo chamado elegível nasce concluir_hoje (fallback
  // de quando o diálogo não conseguiu carregar os chamados pra categorizar).
  // Lista (mesmo vazia) = o que estiver nela vira concluir_hoje, o resto da
  // mesma RT vira revisao_tecnica — nunca exclui ninguém (migration 0046).
  const { data: rotaId, error } = await supabase.rpc("fn_confirmar_rota", {
    p_data: data,
    p_equipe_id: equipeId,
    p_rt_ids: rtIds,
    p_tecnico_ids: tecnicoIds,
    p_chamados_dia: chamadosDia,
    p_tecnicos_extra: tecnicosExtra,
  });

  if (error) return { error: traduzErro(error) };

  revalidatePath("/rotas/montar");
  revalidatePath("/rotas/confirmadas");
  return { error: null, rotaId: rotaId as string };
}
