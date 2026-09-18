"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Prioridade } from "@/app/chamados/prioridade-badge";
import type { StatusChamado } from "@/app/chamados/status-chamado-badge";

export type ActionState = { error: string | null; urgenciaId?: string };

function traduzErro(error: { code?: string; message: string }): string {
  // P0001 = `raise exception` dentro das funções de urgência (migration
  // 0027/0045) — a mensagem já vem pronta em português.
  if (error.code === "P0001") return error.message;
  if (error.code === "23505") return "Já existe uma urgência em andamento para esse chamado.";
  if (error.code === "42501") return "Você não tem permissão pra essa ação.";
  return `Não foi possível concluir a ação (${error.message}).`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// -----------------------------------------------------------------------------
// Busca de chamado (modelo "chamado primeiro", migration 0045) — a Central
// de Urgências nunca cadastra RT/descrição de novo: o gerente busca um
// chamado JÁ existente (protocolo, assunto ou código da RT) e registra a
// urgência sobre ele. Chamados encerrados e chamados que já têm uma urgência
// em andamento não aparecem aqui (evita um clique morto — a função de banco
// também recusaria os dois casos).
// -----------------------------------------------------------------------------
export type ChamadoParaUrgencia = {
  id: string;
  tomticketId: string | null;
  assunto: string;
  descricao: string | null;
  prioridade: Prioridade;
  status: StatusChamado;
  slaPrazo: string | null;
  criadoEm: string;
  rtCodigo: string;
  rtNome: string;
  rtEndereco: string;
  capsNome: string;
  regiaoNome: string;
};

export async function buscarChamadosParaUrgencia(query: string): Promise<ChamadoParaUrgencia[]> {
  // Vírgula, parênteses e aspas são sintaxe do `.or(...)` do PostgREST (separam
  // as cláusulas) — vindo do campo de busca elas quebravam a consulta em 400
  // e a tela devolvia "nenhum chamado" em silêncio. "vazamento, banheiro"
  // passa a buscar "vazamento banheiro". `%`/`_` são curingas do ilike e
  // seguem valendo de propósito.
  const termo = query.replace(/[,()"\\]/g, " ").replace(/\s+/g, " ").trim();
  if (termo.length < 2) return [];

  const supabase = await createClient();

  const [{ data: rtsCorrespondentes }, { data: urgenciasAtivasRaw }] = await Promise.all([
    supabase.from("rts").select("id").ilike("codigo", `%${termo}%`),
    supabase.from("urgencias").select("chamado_id").not("status", "in", "(cancelada,nao_validada)"),
  ]);

  const rtIds = (rtsCorrespondentes ?? []).map((r) => r.id as string);
  const chamadoIdsComUrgenciaAtiva = new Set((urgenciasAtivasRaw ?? []).map((u) => u.chamado_id as string));

  const filtros = [`tomticket_id.ilike.%${termo}%`, `assunto.ilike.%${termo}%`];
  if (rtIds.length > 0) filtros.push(`rt_id.in.(${rtIds.join(",")})`);

  const { data: chamadosRaw, error } = await supabase
    .from("chamados")
    .select(
      "id, tomticket_id, assunto, descricao, prioridade, status, sla_prazo, criado_em, rts(codigo, nome, endereco, caps(nome), regioes(nome))",
    )
    .or(filtros.join(","))
    .not("status", "in", "(finalizado,cancelado)")
    .order("criado_em", { ascending: false })
    .limit(20);

  if (error || !chamadosRaw) return [];

  return chamadosRaw
    .filter((c) => !chamadoIdsComUrgenciaAtiva.has(c.id as string))
    .map((c) => {
      const rt = unwrapOne(c.rts);
      return {
        id: c.id as string,
        tomticketId: c.tomticket_id as string | null,
        assunto: c.assunto as string,
        descricao: (c.descricao as string | null) ?? null,
        prioridade: c.prioridade as Prioridade,
        status: c.status as StatusChamado,
        slaPrazo: c.sla_prazo as string | null,
        criadoEm: c.criado_em as string,
        rtCodigo: rt?.codigo ?? "—",
        rtNome: rt?.nome ?? "—",
        rtEndereco: rt?.endereco ?? "—",
        capsNome: unwrapOne(rt?.caps)?.nome ?? "—",
        regiaoNome: unwrapOne(rt?.regioes)?.nome ?? "—",
      };
    });
}

// -----------------------------------------------------------------------------
// Registro em LOTE a partir de texto colado (pedido do usuário, 17/09/2026).
// O gerente cola a mensagem crua do WhatsApp na barra de registro; a extração
// (app/urgencias/extrair-protocolos.ts) pesca os protocolos, e esta função
// resolve cada um contra o banco pra classificar o que dá e o que não dá pra
// registrar — ANTES de escrever qualquer coisa.
//
// Classifica em vez de só filtrar (diferente de buscarChamadosParaUrgencia,
// que esconde o que não serve): colando 21 protocolos, o gerente precisa
// saber POR QUE 3 ficaram de fora, senão some chamado sem explicação.
// -----------------------------------------------------------------------------
export type SituacaoLote = "ok" | "nao_encontrado" | "ja_tem_urgencia" | "encerrado";

export type ItemLote = {
  protocolo: string;
  /** Texto que veio depois do protocolo na linha colada — vira o motivo da urgência. */
  motivo: string;
  situacao: SituacaoLote;
  chamado: ChamadoParaUrgencia | null;
};

export async function buscarChamadosPorProtocolos(
  itens: { protocolo: string; motivo: string }[],
): Promise<ItemLote[]> {
  if (itens.length === 0) return [];

  const supabase = await createClient();
  const protocolos = itens.map((i) => i.protocolo);

  const [{ data: chamadosRaw }, { data: urgenciasAtivasRaw }] = await Promise.all([
    supabase
      .from("chamados")
      .select(
        "id, tomticket_id, assunto, descricao, prioridade, status, sla_prazo, criado_em, rts(codigo, nome, endereco, caps(nome), regioes(nome))",
      )
      .in("tomticket_id", protocolos),
    supabase.from("urgencias").select("chamado_id").not("status", "in", "(cancelada,nao_validada)"),
  ]);

  const comUrgenciaAtiva = new Set((urgenciasAtivasRaw ?? []).map((u) => u.chamado_id as string));
  const porProtocolo = new Map((chamadosRaw ?? []).map((c) => [c.tomticket_id as string, c]));

  return itens.map(({ protocolo, motivo }) => {
    const c = porProtocolo.get(protocolo);
    if (!c) return { protocolo, motivo, situacao: "nao_encontrado" as const, chamado: null };

    const rt = unwrapOne(c.rts);
    const chamado: ChamadoParaUrgencia = {
      id: c.id as string,
      tomticketId: c.tomticket_id as string | null,
      assunto: c.assunto as string,
      descricao: (c.descricao as string | null) ?? null,
      prioridade: c.prioridade as Prioridade,
      status: c.status as StatusChamado,
      slaPrazo: c.sla_prazo as string | null,
      criadoEm: c.criado_em as string,
      rtCodigo: rt?.codigo ?? "—",
      rtNome: rt?.nome ?? "—",
      rtEndereco: rt?.endereco ?? "—",
      capsNome: unwrapOne(rt?.caps)?.nome ?? "—",
      regiaoNome: unwrapOne(rt?.regioes)?.nome ?? "—",
    };

    const status = c.status as StatusChamado;
    if (status === "finalizado" || status === "cancelado") {
      return { protocolo, motivo, situacao: "encerrado" as const, chamado };
    }
    if (comUrgenciaAtiva.has(c.id as string)) {
      return { protocolo, motivo, situacao: "ja_tem_urgencia" as const, chamado };
    }
    return { protocolo, motivo, situacao: "ok" as const, chamado };
  });
}

// Registra as urgências do lote (fn_registrar_urgencia por item) sobre
// chamados JÁ existentes — nunca cria/duplica chamado.
//
// Uma chamada de RPC por item, não uma transação só: se 2 de 11 falharem
// (alguém registrou a urgência de outro jeito no meio do caminho, chamado
// fechou agora), as outras 9 valem — melhor que perder as 9 por causa de 2.
// O resultado devolve item a item, pra tela mostrar exatamente o que entrou
// e o que não entrou.
//
// Anexo (opcional, ex.: print da conversa): sobe UMA vez e o mesmo path é
// referenciado por todas as urgências do lote — as policies do bucket
// `urgencias-anexos` (0027) valem pro bucket inteiro, não por pasta, então
// ler pelo id de qualquer uma das urgências funciona. Falha no upload não
// derruba o registro, que é o que importa.
export type ResultadoLote = {
  error: string | null;
  registradas?: number;
  falhas?: { protocolo: string; erro: string }[];
  /** Quando o lote tem 1 item só, a tela navega direto pra urgência criada. */
  urgenciaId?: string;
};

type ItemParaRegistrar = { chamadoId: string; protocolo: string; motivo: string };

export async function registrarUrgenciasEmLote(
  _prev: ResultadoLote,
  formData: FormData,
): Promise<ResultadoLote> {
  const origem = String(formData.get("origem") ?? "");
  const solicitante = String(formData.get("solicitante") ?? "").trim();

  let itens: ItemParaRegistrar[] = [];
  try {
    itens = JSON.parse(String(formData.get("itens") ?? "[]")) as ItemParaRegistrar[];
  } catch {
    return { error: "Não foi possível ler os chamados do lote — recomece a seleção." };
  }

  if (itens.length === 0) return { error: "Nenhum chamado no lote. Cole os protocolos ou busque um chamado." };
  if (!origem) return { error: "Selecione a origem da urgência." };
  if (!solicitante) return { error: "Informe quem solicitou." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada — faça login de novo." };

  const criadas: string[] = [];
  const falhas: { protocolo: string; erro: string }[] = [];

  for (const item of itens) {
    const { data: urgenciaId, error } = await supabase.rpc("fn_registrar_urgencia", {
      p_chamado_id: item.chamadoId,
      p_motivo: item.motivo,
      p_origem: origem,
      p_solicitante: solicitante,
      p_anexo_path: null,
    });
    if (error) falhas.push({ protocolo: item.protocolo, erro: traduzErro(error) });
    else criadas.push(urgenciaId as string);
  }

  if (criadas.length === 0) {
    return {
      error: falhas.length === 1 ? falhas[0].erro : "Nenhuma urgência foi registrada.",
      registradas: 0,
      falhas,
    };
  }

  const anexoEntry = formData.get("anexo");
  const anexo = anexoEntry instanceof File && anexoEntry.size > 0 ? anexoEntry : null;
  if (anexo) {
    const path = `${criadas[0]}/anexo-${Date.now()}-${sanitizeFileName(anexo.name)}`;
    const { error: uploadError } = await supabase.storage.from("urgencias-anexos").upload(path, anexo);
    if (!uploadError) {
      await supabase.from("urgencias").update({ anexo_path: path }).in("id", criadas);
    }
  }

  revalidatePath("/urgencias");
  revalidatePath("/chamados");
  return {
    error: null,
    registradas: criadas.length,
    falhas,
    urgenciaId: criadas.length === 1 ? criadas[0] : undefined,
  };
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
  if (!prioridade) return { error: "Selecione a classificação." };

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

// Insere a parada/rota + cria o serviço — a partir daqui é o pipeline de
// execução já existente, sem nenhum código novo (fn_decidir_atendimento_urgencia,
// migrations 0027/0045). O chamado já existia desde o registro; esta função
// nunca cria/edita `chamados`.
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
  revalidatePath("/chamados");
  return { error: null };
}
