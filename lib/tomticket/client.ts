import { TOMTICKET_API_BASE, tomticketToken } from "./config";
import { formatarDataTomTicket } from "./datas";
import { textoDeHtml } from "./html";
import { aguardarVez } from "./limitador";

// Cliente da API v2.0 do TomTicket. Só o que este projeto precisa — três
// endpoints:
//
//   GET  /ticket/list            resolver protocolo -> ticket_id
//   GET  /ticket/detail          reler a conversa (trava anti-duplicata)
//   POST /ticket/reply/operator  responder como atendente, com anexos
//
// `/ticket/finish` era deliberadamente não implementado (quem finalizava era
// outra pessoa). O usuário REVERTEU essa decisão em 08/09/2026: agora o serviço
// validado finaliza o chamado. Repare que `finish` aceita mensagem E anexos —
// então a CONCLUSÃO é uma chamada só (finalizar já entregando a evidência), não
// responder-e-depois-finalizar, que deixaria duas mensagens pro cliente.
// PENDÊNCIA continua em `reply/operator`: ali o trabalho não terminou.
//
// SÓ SERVIDOR. `TOMTICKET_TOKEN` não tem prefixo NEXT_PUBLIC_, então o Next
// nunca o inlina num bundle de client — importar este módulo de um Client
// Component daria `undefined` no lugar do token, não um vazamento. Ainda
// assim: só importe daqui de server actions e route handlers.

export class ErroTomTicket extends Error {}

export class TokenRecusado extends ErroTomTicket {}

export class TomTicketNaoConfigurado extends ErroTomTicket {
  constructor() {
    super(
      "A integração com o TomTicket não está configurada (falta TOMTICKET_TOKEN). " +
        "Gere o token em Configurações > API no TomTicket.",
    );
  }
}

const TENTATIVAS = 4;
const ESPERAS_MS = [2000, 5000, 10000];

export type ReplyTomTicket = {
  message: string;
  sender: string;
  // 'A' = atendente (agente), 'C' = cliente.
  senderType: string;
  date: string;
};

// Por que vale insistir — ou null quando não vale.
//
// Repetir só faz sentido quando a falha é do outro lado e passageira. 401/403 é
// token (repetir dá o mesmo resultado), e 4xx é pedido errado. Regra portada de
// `_vale_repetir` da base-automatizacao.
function motivoParaRepetir(status: number): string | null {
  if (status === 0) return "falha de rede";
  if (status === 429) return "passamos do limite de requisições";
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return `servidor indisponível (${status})`;
  }
  return null;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RespostaApi = Record<string, unknown>;

async function chamar(
  caminho: string,
  init: { method: "GET" | "POST"; params?: Record<string, string>; body?: FormData },
): Promise<RespostaApi> {
  const token = tomticketToken();
  if (!token) throw new TomTicketNaoConfigurado();

  const url = new URL(TOMTICKET_API_BASE + caminho);
  for (const [chave, valor] of Object.entries(init.params ?? {})) {
    if (valor !== "") url.searchParams.set(chave, valor);
  }

  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    await aguardarVez();

    let status = 0;
    let texto = "";
    let corpo: RespostaApi = {};

    try {
      const resposta = await fetch(url, {
        method: init.method,
        // Content-Type do multipart é do fetch: ele monta o boundary sozinho.
        // Definir na mão gera um boundary errado e o servidor recusa.
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        body: init.body,
        cache: "no-store",
      });
      status = resposta.status;
      texto = await resposta.text();
      try {
        corpo = JSON.parse(texto) as RespostaApi;
      } catch {
        corpo = {};
      }
    } catch (erro) {
      status = 0;
      texto = erro instanceof Error ? erro.message : String(erro);
    }

    // CUIDADO: o TomTicket usa 401 pra mais coisa que token inválido —
    // parâmetro malformado também volta 401 (ex.: {"message":"Invalid date."}).
    // Culpar o token em todo 401 mandaria o gerente caçar o problema errado.
    if (status === 401 || status === 403) {
      const daApi = String(corpo.message ?? "").trim();
      const pareceToken = !daApi || /token|unauthorized|autoriz/i.test(daApi);
      throw pareceToken
        ? new TokenRecusado(
            `O TomTicket recusou o token (${status}${daApi ? `: ${daApi}` : ""}). Confira se ele ` +
              "está válido e se o plano da conta inclui a API (Premium ou Enterprise).",
          )
        : new ErroTomTicket(`O TomTicket recusou a requisição (${status}): ${daApi}`);
    }

    const motivo = motivoParaRepetir(status);

    if (!motivo) {
      if (status < 200 || status >= 300) {
        throw new ErroTomTicket(`${caminho} devolveu ${status}: ${texto.slice(0, 200)}`);
      }
      // A API sinaliza erro no próprio corpo, com HTTP 200.
      if (corpo.error) {
        throw new ErroTomTicket(String(corpo.message ?? "o TomTicket recusou a operação."));
      }
      return corpo;
    }

    if (tentativa === TENTATIVAS - 1) {
      throw new ErroTomTicket(
        `${caminho}: ${motivo}. Desisti depois de ${TENTATIVAS} tentativas.`,
      );
    }
    await esperar(ESPERAS_MS[Math.min(tentativa, ESPERAS_MS.length - 1)]);
  }

  throw new ErroTomTicket(`${caminho}: falha inesperada.`);
}

function comoLista(valor: unknown): Record<string, unknown>[] {
  if (Array.isArray(valor)) return valor as Record<string, unknown>[];
  if (valor && typeof valor === "object") return [valor as Record<string, unknown>];
  return [];
}

// Resolve o PROTOCOLO (o número que a gente guarda em `chamados.tomticket_id`,
// ex.: 322810) para o `id` interno que a API exige. São atributos distintos na
// resposta: `protocol` e `id`.
export async function resolverTicketId(protocolo: string): Promise<string | null> {
  const corpo = await chamar("/ticket/list", {
    method: "GET",
    params: { min_protocol: protocolo, max_protocol: protocolo },
  });

  for (const item of comoLista(corpo.data)) {
    if (String(item.protocol ?? "") === String(protocolo)) {
      const id = String(item.id ?? "");
      return id || null;
    }
  }
  return null;
}

// A conversa do chamado. É o que permite conferir, no instante anterior à
// escrita, se a nossa mensagem já está lá — e conferir depois que ela chegou
// de verdade ("o servidor aceitou" e "a mensagem chegou" são coisas
// diferentes quando o que está em jogo é o que o cliente lê).
export async function lerReplies(ticketId: string): Promise<ReplyTomTicket[]> {
  // `ticket_id` conferido na documentação oficial (08/09/2026): "Campo:
  // ticket_id | Tipo: string | Obrigatório: Sim". A base-automatizacao usa `id`
  // aqui e está ERRADA — ela nunca foi exercitada contra uma conta real
  // (admissão do próprio README dela). Não copiar aquele trecho.
  const corpo = await chamar("/ticket/detail", {
    method: "GET",
    params: { ticket_id: ticketId },
  });

  const dados = comoLista(corpo.data)[0] ?? {};
  return comoLista(dados.replies).map((r) => ({
    message: String(r.message ?? ""),
    sender: String(r.sender ?? ""),
    senderType: String(r.sender_type ?? ""),
    date: String(r.date ?? ""),
  }));
}

export type ChamadoTomTicket = {
  protocolo: string;
  ticketId: string;
  assunto: string;
  mensagem: string;
  /** 1=Baixa, 2=Normal, 3=Alta, 4=Urgente (a API devolve número). */
  prioridade: number | null;
  /** 4=Cancelada, 5=Finalizada; todo o resto conta como aberto. */
  situacaoId: number | null;
  clienteNome: string;
  clienteId: string;
  criadoEm: string;
  /** Valor do campo personalizado "RT" (ex.: "RT 09"). É ELE que amarra o
   *  chamado à RT cadastrada aqui — `customer` é o CAPS, não a residência. */
  rtCampo: string;
};

function numeroOuNulo(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function normalizarChamado(bruto: Record<string, unknown>): ChamadoTomTicket {
  const objeto = (chave: string): Record<string, unknown> => {
    const valor = bruto[chave];
    return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
  };
  const cliente = objeto("customer");
  const situacao = objeto("situation");

  // custom_fields.open[] com label "RT". Só vem em /ticket/detail.
  const personalizados = bruto.custom_fields as { open?: unknown } | undefined;
  const abertos = Array.isArray(personalizados?.open) ? personalizados.open : [];
  const campoRt = (abertos as Record<string, unknown>[]).find(
    (f) => String(f?.label ?? "").trim().toUpperCase() === "RT",
  );

  return {
    protocolo: String(bruto.protocol ?? ""),
    ticketId: String(bruto.id ?? ""),
    assunto: String(bruto.subject ?? ""),
    // O corpo pode vir em HTML (editor rico do TomTicket) — vira texto aqui,
    // no ponto de entrada, pra nenhuma tela precisar saber disso.
    mensagem: textoDeHtml(String(bruto.message ?? "")),
    prioridade: numeroOuNulo(bruto.priority),
    situacaoId: numeroOuNulo(situacao.id),
    clienteNome: String(cliente.name ?? ""),
    clienteId: String(cliente.internal_id ?? ""),
    criadoEm: String(bruto.creation_date ?? ""),
    rtCampo: String(campoRt?.value ?? ""),
  };
}

// `last_update_ge` cobre no máximo 90 dias pra trás. Pedir mais não devolve
// mais — devolve erro, e num serviço que ficou dias parado isso seria
// justamente na hora de voltar.
const MAX_DIAS_DE_JANELA = 90;

export function limitarJanela(desde: Date): Date {
  const piso = new Date(Date.now() - MAX_DIAS_DE_JANELA * 24 * 60 * 60 * 1000);
  return desde > piso ? desde : piso;
}

const paraFiltroDeData = formatarDataTomTicket;

export async function listarDepartamentos(): Promise<{ id: string; nome: string }[]> {
  const corpo = await chamar("/department/list", { method: "GET" });
  return comoLista(corpo.data).map((d) => ({
    id: String(d.id ?? ""),
    nome: String(d.name ?? d.description ?? ""),
  }));
}

// Tudo que MUDOU desde `desde`.
//
// Duas chamadas por chamado, e não uma: `/ticket/list` NÃO devolve
// `custom_fields`, e é lá que mora o campo "RT" — o único dado que amarra o
// chamado a uma residência nossa (`customer` é o CAPS, não a RT). Então a
// listagem dá os ids e o detalhe dá o resto.
//
// Repare no que NÃO está aqui: filtro de situação. É deliberado — ver o
// cabeçalho da migration 0030. Filtrar por "aberto" faria o chamado finalizado
// nunca mais voltar na resposta, e ele ficaria aberto aqui pra sempre.
//
// A listagem vem do protocolo mais NOVO pro mais antigo (a API rejeita os
// parâmetros de ordenação), então o teto `maxChamados` corta sempre os mais
// antigos da janela — o que preserva o objetivo principal, que é chamado novo
// aparecer.
export async function listarChamadosAlterados(opcoes: {
  desde: Date;
  departmentId?: string | null;
  maxChamados?: number;
}): Promise<{ chamados: ChamadoTomTicket[]; totalNaJanela: number; cortou: boolean }> {
  const maxChamados = opcoes.maxChamados ?? 300;
  const ids: string[] = [];
  let totalNaJanela = 0;

  for (let pagina = 1; pagina <= 200; pagina++) {
    const corpo = await chamar("/ticket/list", {
      method: "GET",
      params: {
        page: String(pagina),
        last_update_ge: paraFiltroDeData(limitarJanela(opcoes.desde)),
        ...(opcoes.departmentId ? { department_id: opcoes.departmentId } : {}),
      },
    });

    if (pagina === 1) totalNaJanela = numeroOuNulo(corpo.size) ?? 0;

    const itens = comoLista(corpo.data);
    if (itens.length === 0) break;
    for (const item of itens) {
      const id = String(item.id ?? "");
      if (id) ids.push(id);
    }
    if (ids.length >= maxChamados) break;

    const proxima = numeroOuNulo(corpo.next_page);
    if (proxima === null || proxima <= pagina) break;
  }

  const chamados: ChamadoTomTicket[] = [];
  for (const id of ids.slice(0, maxChamados)) {
    chamados.push(await buscarDetalhe(id));
  }

  return { chamados, totalNaJanela, cortou: ids.length > maxChamados || totalNaJanela > maxChamados };
}

// O chamado completo, com `custom_fields` e a mensagem sem truncar.
export async function buscarDetalhe(ticketId: string): Promise<ChamadoTomTicket> {
  const corpo = await chamar("/ticket/detail", { method: "GET", params: { ticket_id: ticketId } });
  const dados = comoLista(corpo.data)[0] ?? {};
  return normalizarChamado(dados);
}

// Deixa o chamado sob responsabilidade de um atendente (o "CSM - SRT").
// Falhar aqui NÃO é motivo pra abortar: o vínculo é organização interna do
// TomTicket, enquanto a mensagem e os anexos são o que o cliente precisa ver.
export async function vincularAtendente(ticketId: string, operatorId: string): Promise<void> {
  const form = new FormData();
  form.set("ticket_id", ticketId);
  form.set("operator_id", operatorId);
  await chamar("/ticket/operator/link", { method: "POST", body: form });
}

export type AnexoParaEnvio = {
  nome: string;
  mime: string;
  conteudo: Uint8Array;
};

// POST /ticket/reply/operator — responde como atendente. Devolve o `id` da
// resposta, que vira recibo e trava de idempotência (migration 0028).
export async function responderComoOperador(opcoes: {
  ticketId: string;
  mensagem: string;
  anexos: AnexoParaEnvio[];
  inicio?: string | null;
  fim?: string | null;
}): Promise<string> {
  const form = new FormData();
  form.set("ticket_id", opcoes.ticketId);
  form.set("message", opcoes.mensagem);

  opcoes.anexos.forEach((anexo, indice) => {
    const bytes = new Uint8Array(anexo.conteudo);
    form.append(
      `attachment[${indice}]`,
      new Blob([bytes], { type: anexo.mime }),
      anexo.nome,
    );
  });

  // Só faz sentido mandar o par completo — a API exige um quando o outro vem.
  if (opcoes.inicio && opcoes.fim) {
    form.set("start_date", opcoes.inicio);
    form.set("end_date", opcoes.fim);
  }

  const corpo = await chamar("/ticket/reply/operator", { method: "POST", body: form });

  const id = String(corpo.id ?? "").trim();
  if (!id) {
    throw new ErroTomTicket(
      "O TomTicket aceitou a resposta mas não devolveu o identificador dela — " +
        "confira no chamado antes de tentar de novo, pra não duplicar a mensagem.",
    );
  }
  return id;
}

// POST /ticket/finish — finaliza o chamado JÁ entregando a mensagem e os
// anexos. `message` é obrigatório aqui (diferente da resposta), e a operação
// não dispara e-mail, igual à resposta.
//
// Não devolve id (a resposta só tem error/message/success), então quem chama
// monta o próprio recibo pra trava de idempotência.
export async function finalizarChamado(opcoes: {
  ticketId: string;
  mensagem: string;
  anexos: AnexoParaEnvio[];
}): Promise<void> {
  const form = new FormData();
  form.set("ticket_id", opcoes.ticketId);
  form.set("message", opcoes.mensagem);

  opcoes.anexos.forEach((anexo, indice) => {
    form.append(
      `attachment[${indice}]`,
      new Blob([new Uint8Array(anexo.conteudo)], { type: anexo.mime }),
      anexo.nome,
    );
  });

  await chamar("/ticket/finish", { method: "POST", body: form });
}
