import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buscarDetalhe,
  listarChamadosAlterados,
  listarDepartamentos,
  listarProtocolosAbertos,
  situacaoDoProtocolo,
  type ChamadoTomTicket,
} from "./client";
import { ehRespostaAutomaticaIgnorada } from "./mensagens";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";

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
  /** Chamados encerrados pela reconciliação (sumiram do TomTicket). */
  reconciliados: number;
  /** Chamados abertos ANTIGOS trazidos pelo resgate (fora da janela de 90 dias). */
  resgatados: number;
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
  primeiroPovoamento: boolean,
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

    // Se estamos INSERINDO a resposta agora, ela nunca foi mostrada ao gerente
    // — então uma resposta de cliente entra como "não vista" e alimenta o
    // sino/toast. Sem gate por timestamp: a comparação
    // `respondidoEm >= <última leitura>` abria uma janela (o intervalo de ~5min
    // entre a resposta chegar e a próxima passada) em que a resposta era
    // sincronizada de forma SILENCIOSA, já marcada como vista. Exceções:
    //   - primeiro povoamento (histórico inteiro entra de uma vez — marcar tudo
    //     como não visto afogaria o sino);
    //   - avisos automáticos de prazo (24h/48h) da própria CSM, que são ruído
    //     previsível (pedido do usuário, 10/09).
    const naoVisto =
      resp.tipo === "cliente" &&
      !primeiroPovoamento &&
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

async function resolverDepartamento(): Promise<string> {
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

export async function sincronizarChamados(
  supabase: SupabaseClient,
  opcoes: {
    /**
     * Força a leitura completa dos abertos (resgate + reconciliação) nesta
     * passada, sem esperar a hora. É o que o botão "Sincronizar" manual usa —
     * quem clica quer ver o resultado agora, não daqui a uma hora.
     */
    completa?: boolean;
  } = {},
): Promise<ResultadoSync> {
  const { data: estado } = await supabase
    .from("sync_estado")
    .select("ultima_leitura")
    .eq("id", true)
    .single();

  // Lido à parte: a coluna só existe depois da migration 0044. Enquanto ela não
  // roda, a reconciliação fica DESLIGADA (o SELECT falha -> `colunaReconciliacao`
  // false) em vez de derrubar a coleta inteira. Assim a feature "liga sozinha"
  // quando a migration entra, sem comportamento surpresa num deploy adiantado.
  let ultimaReconciliacaoMs = 0;
  let colunaReconciliacao = true;
  {
    const { data: rec, error } = await supabase
      .from("sync_estado")
      .select("ultima_reconciliacao")
      .eq("id", true)
      .maybeSingle();
    if (error) {
      colunaReconciliacao = false;
    } else if (rec?.ultima_reconciliacao) {
      ultimaReconciliacaoMs = new Date(rec.ultima_reconciliacao as string).getTime();
    }
  }

  const desde = estado?.ultima_leitura
    ? new Date(new Date(estado.ultima_leitura as string).getTime() - FOLGA_MS)
    : // Primeira coleta: pega o máximo que a API permite (90 dias).
      new Date(0);

  // Marcado ANTES de ler: qualquer escrita que aconteça durante a leitura entra
  // na próxima janela em vez de cair no vão.
  const inicioDaLeitura = new Date();

  const departmentId = await resolverDepartamento();
  const { chamados: lidos, cortou } = await listarChamadosAlterados({ desde, departmentId });

  // Leitura COMPLETA dos abertos do departamento (sem filtro de data), no
  // máximo 1x/hora. Serve a dois fins:
  //
  //   1. Resgate (abaixo): chamado aberto há mais de 90 dias sem ninguém mexer
  //      NUNCA entra pela leitura incremental — a API limita `last_update_ge`
  //      a 90 dias (ver `limitarJanela`). Chamados de janeiro ainda abertos
  //      simplesmente não existiam aqui. Todo protocolo que está aberto lá e
  //      não existe aqui (em nenhum status) tem o detalhe buscado e entra no
  //      MESMO pipeline dos incrementais, logo abaixo.
  //   2. Reconciliação (no fim): encerrar o que sumiu de lá.
  //
  // Fica `null` quando não é hora ou a leitura falhou — e aí nem resgata nem
  // reconcilia, porque agir em cima de lista parcial marcaria chamado vivo
  // como encerrado.
  const RECONCILIA_INTERVALO_MS = 60 * 60 * 1000;
  let abertosNoTomticket: Map<string, string> | null = null;
  const horaDaCompleta = Date.now() - ultimaReconciliacaoMs >= RECONCILIA_INTERVALO_MS;
  if (colunaReconciliacao && (horaDaCompleta || opcoes.completa)) {
    try {
      abertosNoTomticket = await listarProtocolosAbertos(departmentId);
    } catch {
      abertosNoTomticket = null;
    }
  }

  // Resgate dos abertos antigos. Teto por passada porque cada um custa uma
  // requisição de detalhe (3/s): 300 = ~100s, dentro do `maxDuration` da rota
  // de sync. O que sobrar entra na próxima hora — a lista completa é lida de
  // novo e o que já entrou não está mais "faltando".
  const MAX_RESGATE_POR_PASSADA = 300;
  const resgatados = new Set<string>();
  if (abertosNoTomticket) {
    const jaLidos = new Set(lidos.map((c) => c.protocolo));
    const candidatos = [...abertosNoTomticket.keys()].filter((p) => p && !jaLidos.has(p));

    const jaExistem = new Set<string>();
    for (let i = 0; i < candidatos.length; i += 200) {
      const { data } = await supabase
        .from("chamados")
        .select("tomticket_id")
        .in("tomticket_id", candidatos.slice(i, i + 200));
      for (const c of data ?? []) jaExistem.add(String(c.tomticket_id));
    }

    const faltando = candidatos.filter((p) => !jaExistem.has(p)).slice(0, MAX_RESGATE_POR_PASSADA);
    for (const protocolo of faltando) {
      const ticketId = abertosNoTomticket.get(protocolo);
      if (!ticketId) continue;
      try {
        lidos.push(await buscarDetalhe(ticketId));
        resgatados.add(protocolo);
      } catch {
        // um detalhe que falhou não derruba a passada — tenta na próxima hora.
      }
    }
  }

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
  // cliente que está sendo INSERIDA agora entra como "não vista" (alimenta o
  // sino/toast), exceto no primeiro povoamento — aí o histórico inteiro entra
  // de uma vez e marcar tudo como não visto afogaria o contador.
  //
  // Chamado RESGATADO (aberto antigo, fora da janela de 90 dias) entra do
  // mesmo jeito silencioso: as respostas dele têm meses, não são "novidade".
  const primeiroPovoamento = !estado?.ultima_leitura;
  let respostasNovas = 0;
  let anexosBaixados = 0;
  for (const chamado of lidos) {
    const chamadoId = chamado.protocolo ? idPorProtocolo.get(chamado.protocolo) : undefined;
    if (!chamadoId) continue;
    try {
      const r = await sincronizarRespostasEAnexos(
        supabase,
        chamadoId,
        chamado,
        primeiroPovoamento || resgatados.has(chamado.protocolo),
      );
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

  // Reconciliação (migration 0044): um chamado EXCLUÍDO no TomTicket some do
  // `/ticket/list` e a leitura incremental nunca mais o vê — ficaria aberto aqui
  // pra sempre. No máximo 1x/hora, lê a lista COMPLETA de abertos do
  // departamento e encerra qualquer chamado nosso `aberto`/`em_andamento` que
  // não apareça mais lá. Mesmo padrão de `Coletor._ler_tudo` da base-automatizacao.
  //
  // A lista completa já foi lida lá em cima (antes do resgate); aqui só age em
  // cima dela. `abertosNoTomticket` nulo = não era hora ou a leitura falhou —
  // não reconcilia e o relógio não avança.
  let reconciliados = 0;
  let reconciliou = false;

  if (abertosNoTomticket) {
    const abertos = abertosNoTomticket;
    try {
      // A leitura da lista completa terminou sem exceção — só agora dá pra agir
      // e avançar o relógio da reconciliação. Uma leitura parcial marcaria
      // chamados vivos como encerrados.
      reconciliou = true;

      const resolvidosSet = new Set(resolvidos);
      // Só quem a PRÓPRIA sincronização trouxe (tem o id interno do TomTicket,
      // gravado em `tomticket_ticket_id` em todo insert/update daqui). A
      // premissa da reconciliação é "estava no TomTicket e sumiu" — e isso só
      // se afirma sobre chamado que comprovadamente esteve lá. Sem este
      // filtro, os chamados fictícios de teste (protocolo 900000+, que nunca
      // existiram no TomTicket) eram cancelados sozinhos a cada hora —
      // aconteceu de verdade em 11/09/2026 com 3 deles.
      const { data: nossosAbertos } = await todasAsLinhas(() =>
        supabase
          .from("chamados")
          .select("id, tomticket_id")
          .in("status", ["aberto", "em_andamento"])
          .not("tomticket_ticket_id", "is", null)
          .order("id"),
      );

      const sumiram = (nossosAbertos ?? []).filter((c) => {
        const proto = String(c.tomticket_id ?? "").trim();
        // `resolvidosSet`: tocado nesta passada, então está vivo com certeza.
        return proto && !resolvidosSet.has(proto) && !abertos.has(proto);
      });

      // Cada divergência custa 1 requisição pra confirmar a situação. Em uso
      // normal são pouquíssimas; o teto é só um seguro contra um backlog
      // gigante numa primeira passada — o resto entra na próxima janela.
      for (const c of sumiram.slice(0, 200)) {
        const proto = String(c.tomticket_id).trim();
        let novoStatus: StatusChamado = "cancelado"; // sumiu de vez = foi excluído
        try {
          const s = await situacaoDoProtocolo(proto);
          if (s.existe) {
            const traduzido = traduzirStatus(s.situacaoId);
            // Ainda aberto no TomTicket = ruído de paginação da lista completa;
            // não mexe.
            if (traduzido !== "finalizado" && traduzido !== "cancelado") continue;
            novoStatus = traduzido;
          }
        } catch {
          // sem conseguir confirmar a situação, trata como fora de cena mesmo.
        }
        const { error } = await supabase
          .from("chamados")
          .update({ status: novoStatus })
          .eq("id", c.id as string);
        if (!error) reconciliados++;
      }
    } catch {
      // Leitura parcial / falha de rede: NÃO reconcilia em cima de dado
      // incompleto e o relógio da reconciliação não avança (tenta na próxima).
      reconciliou = false;
    }
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

  // Gravado à parte do UPDATE principal: `reconciliou` só é true quando a coluna
  // existe (0044 aplicada) E a leitura completa terminou. Separado pra um erro
  // aqui nunca derrubar o UPDATE de `ultima_leitura` acima.
  if (reconciliou) {
    await supabase
      .from("sync_estado")
      .update({ ultima_reconciliacao: new Date().toISOString() })
      .eq("id", true);
  }

  return {
    novos,
    atualizados,
    ignorados: naoImportados.length,
    lidos: lidos.length,
    cortou,
    servicosCriados,
    respostasNovas,
    anexosBaixados,
    reconciliados,
    resgatados: resgatados.size,
  };
}
