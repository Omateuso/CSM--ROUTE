"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ErroTomTicket,
  lerReplies,
  resolverTicketId,
  responderComoOperador,
  vincularAtendente,
  type AnexoParaEnvio,
} from "@/lib/tomticket/client";
import {
  TOMTICKET_MAX_ANEXOS,
  TOMTICKET_MAX_MENSAGEM,
  TOMTICKET_MAX_REQUISICAO_BYTES,
  tomticketConfigurado,
} from "@/lib/tomticket/config";
import { jaEstaNaConversa } from "@/lib/tomticket/conversa";

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

// -----------------------------------------------------------------------------
// Responder o cliente pelo modal de detalhe do chamado (item 8, 10/09/2026).
//
// O cliente pode responder o chamado no TomTicket e, até aqui, o gerente não
// tinha como responder de volta pelo sistema. Isto envia uma resposta de
// ATENDENTE (`/ticket/reply/operator`), com anexos opcionais, SEM finalizar o
// chamado (é acompanhamento, não conclusão — a conclusão validada tem o fluxo
// próprio em /validacao). Só `gerente`.
//
// Sem migration: a idempotência real é a trava viva (releitura da conversa no
// TomTicket), que o projeto já trata como o guard primário; o `historico` fica
// como registro. Nossa resposta volta como reply de atendente na próxima sync e
// entra em `chamado_respostas` normalmente.
// -----------------------------------------------------------------------------
export type RespostaChamadoState = { error: string | null; aviso: string | null; ok: boolean };

const MARGEM_ANEXO_BYTES = 512 * 1024;

export async function responderChamado(
  _prev: RespostaChamadoState,
  formData: FormData,
): Promise<RespostaChamadoState> {
  const chamadoId = String(formData.get("chamadoId") ?? "");
  const mensagem = String(formData.get("mensagem") ?? "").trim();
  const arquivos = formData
    .getAll("arquivos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!chamadoId) return { error: "Chamado inválido.", aviso: null, ok: false };
  if (!mensagem) return { error: "A mensagem não pode ficar vazia.", aviso: null, ok: false };
  if (mensagem.length > TOMTICKET_MAX_MENSAGEM) {
    return {
      error: `A mensagem tem ${mensagem.length} caracteres e o TomTicket aceita no máximo ${TOMTICKET_MAX_MENSAGEM}.`,
      aviso: null,
      ok: false,
    };
  }
  if (!tomticketConfigurado()) {
    return {
      error:
        "A integração com o TomTicket ainda não foi configurada (falta o token). Responda pelo TomTicket por enquanto.",
      aviso: null,
      ok: false,
    };
  }
  if (arquivos.length > TOMTICKET_MAX_ANEXOS) {
    return {
      error: `O TomTicket aceita no máximo ${TOMTICKET_MAX_ANEXOS} anexos por resposta.`,
      aviso: null,
      ok: false,
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre de novo.", aviso: null, ok: false };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gerente") {
    return { error: "Só o gerente pode responder um chamado no TomTicket.", aviso: null, ok: false };
  }

  const { data: chamado } = await supabase
    .from("chamados")
    .select("id, tomticket_id, tomticket_ticket_id")
    .eq("id", chamadoId)
    .single();
  if (!chamado) return { error: "Chamado não encontrado.", aviso: null, ok: false };

  const protocolo = String(chamado.tomticket_id ?? "").trim();
  if (!protocolo) {
    return {
      error: "Esse chamado é de entrada manual e não tem protocolo do TomTicket pra responder.",
      aviso: null,
      ok: false,
    };
  }

  const anexos: AnexoParaEnvio[] = [];
  let totalBytes = 0;
  for (const arquivo of arquivos) {
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    totalBytes += bytes.byteLength;
    anexos.push({
      nome: arquivo.name || "anexo",
      mime: arquivo.type || "application/octet-stream",
      conteudo: bytes,
    });
  }
  if (totalBytes > TOMTICKET_MAX_REQUISICAO_BYTES - MARGEM_ANEXO_BYTES) {
    return {
      error: `Os anexos somam ${(totalBytes / 1024 / 1024).toFixed(1)} MB e o TomTicket aceita no máximo ${(
        TOMTICKET_MAX_REQUISICAO_BYTES /
        1024 /
        1024
      ).toFixed(0)} MB por resposta. Anexe os maiores manualmente no TomTicket.`,
      aviso: null,
      ok: false,
    };
  }

  try {
    let ticketId = String(chamado.tomticket_ticket_id ?? "").trim();
    if (!ticketId) {
      const resolvido = await resolverTicketId(protocolo);
      if (!resolvido) {
        return {
          error: `Não achei o chamado #${protocolo} no TomTicket. Confira se o protocolo está certo.`,
          aviso: null,
          ok: false,
        };
      }
      ticketId = resolvido;
      await supabase.from("chamados").update({ tomticket_ticket_id: ticketId }).eq("id", chamadoId);
    }

    // Trava viva: a conversa AO VIVO já tem essa mensagem? Cobre um envio
    // anterior que chegou ao TomTicket e falhou ao registrar aqui.
    const antes = await lerReplies(ticketId);
    if (jaEstaNaConversa(antes, mensagem)) {
      return {
        error:
          "Essa mensagem já aparece na conversa do chamado no TomTicket — não enviei de novo pra não duplicar.",
        aviso: null,
        ok: false,
      };
    }

    // Vincular o atendente é organização interna do TomTicket — erro engolido
    // de propósito, não pode custar a resposta.
    const operadorId = process.env.TOMTICKET_OPERADOR_ID?.trim();
    if (operadorId) {
      try {
        await vincularAtendente(ticketId, operadorId);
      } catch {
        // segue o fluxo
      }
    }

    await responderComoOperador({ ticketId, mensagem, anexos });

    await supabase.from("historico").insert({
      chamado_id: chamadoId,
      evento: "tomticket_respondido",
      descricao: `Resposta ao cliente enviada ao TomTicket:\n\n${mensagem}`,
      criado_por: user.id,
    });

    revalidatePath("/chamados");
    revalidatePath("/", "layout");

    // "O servidor aceitou" e "a mensagem chegou" são coisas diferentes.
    const depois = await lerReplies(ticketId);
    if (!jaEstaNaConversa(depois, mensagem)) {
      return {
        error: null,
        ok: true,
        aviso:
          "O TomTicket aceitou a resposta, mas ela ainda não apareceu na conversa. Confira no chamado antes de reenviar.",
      };
    }

    return { error: null, aviso: null, ok: true };
  } catch (erro) {
    if (erro instanceof ErroTomTicket) return { error: erro.message, aviso: null, ok: false };
    return {
      error: `Não consegui responder no TomTicket (${erro instanceof Error ? erro.message : String(erro)}).`,
      aviso: null,
      ok: false,
    };
  }
}
