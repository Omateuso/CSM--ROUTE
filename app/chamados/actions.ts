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


// Mensagem e linha do tempo de UM chamado, buscadas quando o modal abre.
//
// Antes viajavam junto da lista, pros ~300 chamados de uma vez, mesmo sendo
// usadas só aqui — inflava o HTML da tela e o payload de hidratação sem
// ninguém ler. A lista continua trazendo tudo que ela própria mostra e filtra;
// só o que é exclusivo do modal saiu de lá.
export type DetalheChamado = {
  descricao: string | null;
  historico: {
    id: string;
    evento: string;
    descricao: string | null;
    categoria: string | null;
    criadoEm: string;
    criadoPorNome: string | null;
  }[];
  // Fase 3 — conversa do chamado no TomTicket e anexos do cliente (0036).
  respostas: {
    id: string;
    tipo: "cliente" | "atendente";
    remetente: string | null;
    mensagem: string | null;
    respondidoEm: string | null;
  }[];
  anexosCliente: { id: string; nome: string; origem: "abertura" | "resposta"; url: string | null }[];
};

export async function buscarDetalheChamado(chamadoId: string): Promise<DetalheChamado> {
  const supabase = await createClient();

  const [{ data: chamado }, { data: eventos }, { data: respostasRaw }, { data: anexosRaw }] = await Promise.all([
    supabase.from("chamados").select("descricao").eq("id", chamadoId).maybeSingle(),
    supabase
      .from("historico")
      .select("id, evento, descricao, categoria, criado_em, criado_por:criado_por(nome)")
      .eq("chamado_id", chamadoId)
      .order("criado_em", { ascending: true }),
    supabase
      .from("chamado_respostas")
      .select("id, tipo, remetente, mensagem, respondido_em")
      .eq("chamado_id", chamadoId)
      .order("respondido_em", { ascending: true, nullsFirst: true }),
    supabase
      .from("chamado_anexos_cliente")
      .select("id, nome, origem, storage_path")
      .eq("chamado_id", chamadoId)
      .order("criado_em", { ascending: true }),
  ]);

  const caminhos = (anexosRaw ?? []).map((a) => a.storage_path as string);
  const urlPorCaminho = new Map<string, string>();
  if (caminhos.length > 0) {
    const { data: assinadas } = await supabase.storage.from("respostas-cliente").createSignedUrls(caminhos, 3600);
    for (const item of assinadas ?? []) {
      if (item.signedUrl) urlPorCaminho.set(item.path ?? "", item.signedUrl);
    }
  }

  return {
    descricao: (chamado?.descricao as string | null) ?? null,
    historico: (eventos ?? []).map((h) => {
      const autor = Array.isArray(h.criado_por) ? h.criado_por[0] : h.criado_por;
      return {
        id: h.id as string,
        evento: h.evento as string,
        descricao: (h.descricao as string | null) ?? null,
        categoria: (h.categoria as string | null) ?? null,
        criadoEm: h.criado_em as string,
        criadoPorNome: autor?.nome ?? null,
      };
    }),
    respostas: (respostasRaw ?? []).map((r) => ({
      id: r.id as string,
      tipo: r.tipo as "cliente" | "atendente",
      remetente: (r.remetente as string | null) ?? null,
      mensagem: (r.mensagem as string | null) ?? null,
      respondidoEm: (r.respondido_em as string | null) ?? null,
    })),
    anexosCliente: (anexosRaw ?? []).map((a) => ({
      id: a.id as string,
      nome: a.nome as string,
      origem: a.origem as "abertura" | "resposta",
      url: urlPorCaminho.get(a.storage_path as string) ?? null,
    })),
  };
}

// Marca as respostas do cliente de um chamado como vistas — some do sino.
// Disparada quando o gerente/gestão abre o modal de detalhe.
export async function marcarRespostasVistas(chamadoId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("fn_marcar_respostas_vistas", { p_chamado_id: chamadoId });
  revalidatePath("/chamados");
  revalidatePath("/", "layout"); // atualiza o contador do sino no menu
}
