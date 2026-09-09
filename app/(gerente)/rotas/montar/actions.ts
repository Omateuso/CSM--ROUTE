"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

// Grava rotas + rota_rts numa transação só via fn_confirmar_rota (migration
// 0011) — nunca dois inserts separados aqui, senão uma falha no segundo
// deixaria uma `rotas` órfã sem nenhuma RT.
export async function confirmarRota(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const data = String(formData.get("data") ?? "");
  const equipeId = String(formData.get("equipeId") ?? "");
  const rtIdsRaw = String(formData.get("rtIds") ?? "");
  const tecnicoIdsRaw = String(formData.get("tecnicoIds") ?? "");

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

  const supabase = await createClient();

  // Sem `p_chamado_ids`: `fn_confirmar_rota` gera um serviço por chamado
  // elegível de cada RT (o técnico recebe todos os chamados em aberto). A
  // escolha manual por chamado (0033) foi removida em 09/09/2026.
  const { data: rotaId, error } = await supabase.rpc("fn_confirmar_rota", {
    p_data: data,
    p_equipe_id: equipeId,
    p_rt_ids: rtIds,
    p_tecnico_ids: tecnicoIds,
  });

  if (error) return { error: traduzErro(error) };

  revalidatePath("/rotas/montar");
  revalidatePath("/rotas/confirmadas");
  return { error: null, rotaId: rotaId as string };
}
