import type { SupabaseClient } from "@supabase/supabase-js";
import { listarChamadosAlterados, listarDepartamentos, type ChamadoTomTicket } from "./client";
import { ehRespostaAutomaticaIgnorada } from "./mensagens";

// Coleta direta do TomTicket — substitui o import por planilha (ver migration
// 0030 pro racional completo).

// Códigos de situação do TomTicket (catálogo confirmado na base-automatizacao,
// que os tirou do próprio console). Só 4 e 5 tiram o chamado de cena.
const SITUACAO_CANCELADA = 4;
const SITUACAO_FINALIZADA = 5;
// Sem atendente vinculado / não iniciada: ainda ninguém pegou.
const SITUACOES_NAO_INICIADAS = [0, 1];

type StatusChamado = "aberto" | "em_andamento" | "finalizado" | "cancelado";
type PrioridadeChamado = "emergencial" | "alta" | "normal" | "baixa";

export function traduzirStatus(situacaoId: number | null): StatusChamado {
  if (situacaoId === SITUACAO_CANCELADA) return "cancelado";
  if (situacaoId === SITUACAO_FINALIZADA) return "finalizado";
  if (situacaoId !== null && SITUACOES_NAO_INICIADAS.includes(situacaoId)) return "aberto";
  // Situação desconhecida conta como ABERTA, de propósito: se o TomTicket criar
  // um código novo, o chamado aparece. Sumir com uma parada de rota por causa
  // de um código que ninguém mapeou é o erro caro.
  return "em_andamento";
}

export function traduzirPrioridade(prioridade: number | null): PrioridadeChamado {
  if (prioridade === 4) return "emergencial";
  if (prioridade === 3) return "alta";
  if (prioridade === 1) return "baixa";
  return "normal";
}

// Tira acento, caixa e espaço duplicado — os dois lados são texto digitado por
// gente, e "SRT 65" / "srt  65" / "SRT65" têm que casar.
function normalizar(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export type RtParaCasamento = { id: string; codigo: string; tomticketCustomerId: string | null };

// Extrai o número da RT de um rótulo. Nosso cadastro usa "SRT 65"; o TomTicket
// preenche o campo personalizado como "RT 09" (com zero à esquerda). O número é
// o que os dois têm em comum.
function numeroDaRt(texto: string): string | null {
  const casou = String(texto).match(/(\d+)/);
  return casou ? String(Number(casou[1])) : null;
}

// Acha a RT de um chamado do TomTicket.
//
// CONFERIDO CONTRA A CONTA REAL (08/09/2026): a RT NÃO está em `customer` —
// ali fica o CAPS ("CAPS JOAO FERREIRA"). Ela vem no campo personalizado "RT"
// (`custom_fields.open[]`), que é justamente a coluna que a Busca Avançada
// exportava. Numa amostra de 40 chamados do departamento MANUTENÇÃO - SRT, o
// campo estava preenchido em 100% e o casamento por número acertou 40/40.
export function acharRt(chamado: ChamadoTomTicket, rts: RtParaCasamento[]): RtParaCasamento | null {
  if (chamado.clienteId) {
    const porId = rts.find((rt) => rt.tomticketCustomerId === chamado.clienteId);
    if (porId) return porId;
  }

  const numero = numeroDaRt(chamado.rtCampo);
  if (numero) {
    const porNumero = rts.find((rt) => numeroDaRt(rt.codigo) === numero);
    if (porNumero) return porNumero;
  }

  // Fallback: rótulo idêntico (cobre RT sem número, como a de teste).
  const alvo = normalizar(chamado.rtCampo);
  if (alvo) {
    const exato = rts.find((rt) => normalizar(rt.codigo) === alvo);
    if (exato) return exato;
  }

  return null;
}

export type ResultadoSync = {
  novos: number;
  atualizados: number;
  ignorados: number;
  lidos: number;
  /** A janela tinha mais chamados do que o teto de uma passada. */
  cortou: boolean;
  /** Serviços criados em rotas JÁ confirmadas, pros chamados que chegaram agora. */
  servicosCriados: number;
  /** Respostas de CLIENTE novas gravadas nesta passada (alimentam o sino). */
  respostasNovas: number;
  /** Anexos do cliente baixados pro bucket nesta passada. */
  anexosBaixados: number;
};

// Nome de arquivo seguro pro path do Storage: sem acento, sem espaço, sem
// caractere que o bucket recuse, e não gigante.
function nomeSeguro(nome: string): string {
  const base = (nome || "arquivo")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (base || "arquivo").slice(0, 120);
}

// Grava as respostas (cliente + atendente) e baixa os anexos de UM chamado.
// `/ticket/detail` já trouxe tudo isso na mesma requisição da sync — aqui não
// há chamada de API a mais, só o download dos arquivos (uma vez cada, dedup
// por URL). Falhar aqui NÃO aborta a sync: o chamado já entrou, e o que não
// gravou volta na próxima passada.
async function sincronizarRespostasEAnexos(
  supabase: SupabaseClient,
  chamadoId: string,
  chamado: ChamadoTomTicket,
  marcarNaoVistoDesde: Date,
): Promise<{ respostasNovas: number; anexosBaixados: number }> {
  let respostasNovas = 0;
  let anexosBaixados = 0;

  // Respostas já conhecidas -> id da linha (pra amarrar anexo de resposta).
  const { data: existentesRaw } = await supabase
    .from("chamado_respostas")
    .select("id, tomticket_reply_id")
    .eq("chamado_id", chamadoId);
  const idPorReply = new Map<string, string>(
    (existentesRaw ?? []).map((r) => [r.tomticket_reply_id as string, r.id as string]),
  );

  for (const resp of chamado.respostas) {
    if (idPorReply.has(resp.replyId)) continue;

    const naoVisto =
      resp.tipo === "cliente" &&
      resp.respondidoEm !== null &&
      new Date(resp.respondidoEm) >= marcarNaoVistoDesde &&
      // Avisos automáticos de prazo (24h/48h) da própria CSM não alimentam o
      // sino nem o toast — entram já como "vistos" (pedido do usuário, 10/09).
      !ehRespostaAutomaticaIgnorada(resp.mensagem);

    const { data: inserida, error } = await supabase
      .from("chamado_respostas")
      .insert({
        chamado_id: chamadoId,
        tomticket_reply_id: resp.replyId,
        tipo: resp.tipo,
        remetente: resp.remetente || null,
        mensagem: resp.mensagem || null,
        respondido_em: resp.respondidoEm,
        visto_em: naoVisto ? null : new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !inserida) continue; // corrida com outra passada, ou erro — tenta de novo depois
    idPorReply.set(resp.replyId, inserida.id as string);
    if (naoVisto) respostasNovas++;
  }

  // Anexos já baixados -> não baixa de novo.
  const { data: anexosRaw } = await supabase
    .from("chamado_anexos_cliente")
    .select("tomticket_url")
    .eq("chamado_id", chamadoId);
  const urlsBaixadas = new Set((anexosRaw ?? []).map((a) => a.tomticket_url as string));

  type Pendente = { url: string; nome: string; tamanho: number | null; origem: "abertura" | "resposta"; replyId: string | null };
  const pendentes: Pendente[] = [
    ...chamado.anexosAbertura.map((a) => ({ ...a, origem: "abertura" as const, replyId: null })),
    ...chamado.respostas.flatMap((r) =>
      r.anexos.map((a) => ({ ...a, origem: "resposta" as const, replyId: r.replyId })),
    ),
  ];

  for (const [i, anexo] of pendentes.entries()) {
    if (urlsBaixadas.has(anexo.url)) continue;

    let bytes: ArrayBuffer;
    let contentType = "application/octet-stream";
    try {
      const r = await fetch(anexo.url, { cache: "no-store" });
      if (!r.ok) continue;
      bytes = await r.arrayBuffer();
      contentType = r.headers.get("content-type") ?? contentType;
    } catch {
      continue;
    }

    const chave = anexo.origem === "resposta" ? (anexo.replyId ?? "resposta") : "abertura";
    const path = `${chamadoId}/${anexo.origem}-${chave}-${i}-${nomeSeguro(anexo.nome)}`;

    const { error: upErr } = await supabase.storage
      .from("respostas-cliente")
      .upload(path, new Uint8Array(bytes), { contentType, upsert: false });
    if (upErr && !upErr.message.toLowerCase().includes("exists")) continue;

    const { error: insErr } = await supabase.from("chamado_anexos_cliente").insert({
      chamado_id: chamadoId,
      resposta_id: anexo.replyId ? (idPorReply.get(anexo.replyId) ?? null) : null,
      origem: anexo.origem,
      nome: anexo.nome || "arquivo",
      tamanho: anexo.tamanho,
      storage_path: path,
      tomticket_url: anexo.url,
    });
    if (!insErr) {
      urlsBaixadas.add(anexo.url);
      anexosBaixados++;
    }
  }

  return { respostasNovas, anexosBaixados };
}

// Folga da janela: cada leitura pergunta a partir de um instante um pouco
// anterior ao fim da anterior. Relógios de servidores diferentes não batem no
// milissegundo, e uma escrita bem na fronteira ficaria invisível pra sempre.
// Reler alguns a mais custa quase nada; perder um custa uma visita.
const FOLGA_MS = 5 * 60 * 1000;

async function resolverDepartamento(): Promise<string | null> {
  // Default NÃO é "todos": a conta inteira tem ~330 mil chamados de 200
  // departamentos (atestado, RH, laboratório...). Só MANUTENÇÃO - SRT interessa
  // — são ~8,9 mil. Sincronizar sem filtro encheria o banco de lixo.
  const nome = process.env.TOMTICKET_DEPARTAMENTO?.trim() || "MANUTENÇÃO - SRT";

  const alvo = normalizar(nome);
  const departamentos = await listarDepartamentos();
  const achado = departamentos.find((d) => normalizar(d.nome) === alvo);
  if (!achado) {
    throw new Error(
      `Não achei o departamento "${nome}" no TomTicket. Departamentos disponíveis: ` +
        departamentos.map((d) => d.nome).join(", "),
    );
  }
  return achado.id;
}

export async function sincronizarChamados(supabase: SupabaseClient): Promise<ResultadoSync> {
  const { data: estado } = await supabase
    .from("sync_estado")
    .select("ultima_leitura")
    .eq("id", true)
    .single();

  const desde = estado?.ultima_leitura
    ? new Date(new Date(estado.ultima_leitura as string).getTime() - FOLGA_MS)
    : // Primeira coleta: pega o máximo que a API permite (90 dias).
      new Date(0);

  // Marcado ANTES de ler: qualquer escrita que aconteça durante a leitura entra
  // na próxima janela em vez de cair no vão.
  const inicioDaLeitura = new Date();

  const departmentId = await resolverDepartamento();
  const { chamados: lidos, cortou } = await listarChamadosAlterados({ desde, departmentId });

  const { data: rtsRaw } = await supabase.from("rts").select("id, codigo, tomticket_customer_id");
  const rts: RtParaCasamento[] = (rtsRaw ?? []).map((rt) => ({
    id: rt.id as string,
    codigo: rt.codigo as string,
    tomticketCustomerId: (rt.tomticket_customer_id as string | null) ?? null,
  }));

  const protocolos = lidos.map((c) => c.protocolo).filter(Boolean);
  const existentes = new Map<
    string,
    { id: string; assunto: string; descricao: string | null; prioridade: string; status: string; rt_id: string }
  >();

  // `in` numa lista muito grande estoura a URL — vai em blocos.
  for (let i = 0; i < protocolos.length; i += 200) {
    const bloco = protocolos.slice(i, i + 200);
    const { data } = await supabase
      .from("chamados")
      .select("id, tomticket_id, assunto, descricao, prioridade, status, rt_id")
      .in("tomticket_id", bloco);
    for (const c of data ?? []) {
      existentes.set(c.tomticket_id as string, {
        id: c.id as string,
        assunto: c.assunto as string,
        descricao: (c.descricao as string | null) ?? null,
        prioridade: c.prioridade as string,
        status: c.status as string,
        rt_id: c.rt_id as string,
      });
    }
  }

  const paraInserir: Record<string, unknown>[] = [];
  const naoImportados: Record<string, unknown>[] = [];
  const resolvidos: string[] = [];
  let atualizados = 0;

  for (const chamado of lidos) {
    if (!chamado.protocolo) continue;

    const rt = acharRt(chamado, rts);
    if (!rt) {
      naoImportados.push({
        tomticket_id: chamado.protocolo,
        ticket_id: chamado.ticketId,
        assunto: chamado.assunto,
        cliente_nome: chamado.clienteNome,
        motivo: chamado.rtCampo
          ? `Nenhuma RT cadastrada bate com "${chamado.rtCampo}".`
          : "O chamado veio sem o campo RT preenchido no TomTicket.",
        visto_em: new Date().toISOString(),
      });
      continue;
    }

    const campos = {
      rt_id: rt.id,
      assunto: chamado.assunto || "(sem assunto)",
      descricao: chamado.mensagem || null,
      prioridade: traduzirPrioridade(chamado.prioridade),
      status: traduzirStatus(chamado.situacaoId),
      tomticket_ticket_id: chamado.ticketId || null,
    };

    const atual = existentes.get(chamado.protocolo);
    if (!atual) {
      paraInserir.push({
        ...campos,
        tomticket_id: chamado.protocolo,
        // Só no insert: a data de criação do chamado não muda depois.
        ...(chamado.criadoEm ? { criado_em: chamado.criadoEm } : {}),
      });
      resolvidos.push(chamado.protocolo);
      continue;
    }

    // Só escreve se algo mudou de verdade — evita mexer em `atualizado_em` e
    // disparar o trigger de SLA (0008) à toa em cada passada.
    const mudou =
      atual.assunto !== campos.assunto ||
      atual.descricao !== campos.descricao ||
      atual.prioridade !== campos.prioridade ||
      atual.status !== campos.status ||
      atual.rt_id !== campos.rt_id;

    if (mudou) {
      const { error } = await supabase.from("chamados").update(campos).eq("id", atual.id);
      if (!error) atualizados++;
    }
    resolvidos.push(chamado.protocolo);
  }

  // protocolo -> chamado_id (uuid), pra Fase 3 amarrar as respostas. Começa
  // com os que já existiam; ganha os recém-inseridos abaixo.
  const idPorProtocolo = new Map<string, string>(
    [...existentes.entries()].map(([proto, dados]) => [proto, dados.id]),
  );

  let novos = 0;
  for (let i = 0; i < paraInserir.length; i += 200) {
    const bloco = paraInserir.slice(i, i + 200);
    const { data, error } = await supabase.from("chamados").insert(bloco).select("id, tomticket_id");
    if (!error) {
      novos += data?.length ?? 0;
      for (const c of data ?? []) idPorProtocolo.set(c.tomticket_id as string, c.id as string);
    }
  }

  if (naoImportados.length > 0) {
    await supabase.from("sync_nao_importados").upsert(naoImportados, { onConflict: "tomticket_id" });
  }
  // O que finalmente entrou sai da lista de pendências (a RT foi cadastrada
  // depois, ou o nome foi corrigido no TomTicket).
  for (let i = 0; i < resolvidos.length; i += 200) {
    await supabase.from("sync_nao_importados").delete().in("tomticket_id", resolvidos.slice(i, i + 200));
  }

  // Fase 3: respostas e anexos do cliente. `/ticket/detail` já trouxe replies
  // e attachments na MESMA requisição que a sync já fez — sem chamada de API a
  // mais aqui, só o download dos arquivos (uma vez cada). Uma resposta de
  // cliente só entra como "não vista" (alimenta o sino) se chegou DEPOIS da
  // última leitura — no primeiro povoamento, o histórico entra já marcado
  // como visto pra não afogar o contador.
  const marcarNaoVistoDesde = estado?.ultima_leitura
    ? new Date(estado.ultima_leitura as string)
    : inicioDaLeitura;
  let respostasNovas = 0;
  let anexosBaixados = 0;
  for (const chamado of lidos) {
    const chamadoId = chamado.protocolo ? idPorProtocolo.get(chamado.protocolo) : undefined;
    if (!chamadoId) continue;
    try {
      const r = await sincronizarRespostasEAnexos(supabase, chamadoId, chamado, marcarNaoVistoDesde);
      respostasNovas += r.respostasNovas;
      anexosBaixados += r.anexosBaixados;
    } catch {
      // uma falha aqui não invalida a coleta — o chamado já entrou.
    }
  }

  // Chamado novo não alcança o técnico sozinho: `fn_confirmar_rota` só olha os
  // elegíveis no instante da confirmação. Depois de trazer os chamados, completa
  // as rotas de hoje pra frente que já estão confirmadas — senão um chamado que
  // nasceu agora ficaria invisível em campo até alguém remontar a rota (foi o
  // caso real do #331166). Ver migration 0032.
  let servicosCriados = 0;
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: rotasAbertas } = await supabase
    .from("rotas")
    .select("id")
    .eq("status", "confirmada")
    .gte("data", hoje);

  for (const rota of rotasAbertas ?? []) {
    const { data: criados, error } = await supabase.rpc("fn_atualizar_servicos_rota", {
      p_rota_id: rota.id as string,
    });
    // Falhar aqui não invalida a coleta em si — os chamados já entraram.
    if (!error) servicosCriados += Number(criados ?? 0);
  }

  // O relógio só avança porque chegamos aqui sem exceção. Se a coleta falhar, a
  // rota de erro NÃO grava `ultima_leitura` — senão a próxima passada pularia
  // justamente a janela que falhou.
  await supabase
    .from("sync_estado")
    .update({
      ultima_leitura: inicioDaLeitura.toISOString(),
      ultima_execucao: new Date().toISOString(),
      ultimo_erro: null,
      novos,
      atualizados,
      ignorados: naoImportados.length,
    })
    .eq("id", true);

  return {
    novos,
    atualizados,
    ignorados: naoImportados.length,
    lidos: lidos.length,
    cortou,
    servicosCriados,
    respostasNovas,
    anexosBaixados,
  };
}
