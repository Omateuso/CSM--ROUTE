import type { PendenciaCategoria } from "@/lib/ui/pendencia-categoria";

// Textos enviados ao TomTicket.
//
// São PONTO DE PARTIDA, não trava: o gerente vê a mensagem montada no diálogo
// e pode escrever a dele antes de enviar (pedido do usuário, 08/09/2026). Por
// isso este módulo é puro — sem acesso a env, sem I/O — e pode ser importado
// tanto do server action quanto do Client Component que monta o diálogo.

const ASSINATURA = ["Att,", "", "CSM Construções.", "", "SM - SRT", "", "André Luis."].join("\n");

export const SAUDACOES = ["Bom dia", "Boa tarde", "Boa noite"] as const;
export type Saudacao = (typeof SAUDACOES)[number];

// Fuso fixado em São Paulo de propósito. `new Date().getHours()` usa o fuso do
// PROCESSO — em produção (Vercel) isso é UTC, e às 15h no Rio daria "Boa
// noite". Fixar o fuso também garante que servidor e client cheguem no mesmo
// texto, sem descasamento de hidratação.
export function saudacao(agora: Date = new Date()): Saudacao {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hourCycle: "h23",
    }).format(agora),
  );

  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function montar(partes: (string | null)[]): string {
  return partes.filter((p) => p !== null && p !== "").join("\n\n");
}

// O texto padrão do usuário, literal — só a saudação varia com a hora.
export function mensagemConclusao(comSaudacao: Saudacao = saudacao()): string {
  return montar([
    `${comSaudacao}.`,
    "Informo que a equipe esteve na residência e realizou os serviços solicitados, segue o anexo.",
    ASSINATURA,
  ]);
}

// Uma pendência é um ato de fala diferente da conclusão: a equipe esteve lá e
// NÃO terminou. Por isso são cinco textos, não um.
//
// `aguardando_gestao` é o caso que justifica a separação sozinho — ali o
// chamado está parado esperando uma decisão DA IGEDES, então a mensagem é um
// pedido, não um aviso. Mandar "faremos o retorno" nesse caso esconderia do
// cliente que a bola está com ele.
const MOTIVO: Record<PendenciaCategoria, string> = {
  falta_material: "o serviço não pôde ser concluído por falta de material",
  aguardando_gestao:
    "o serviço depende de uma definição da gestão junto ao proprietário/imobiliária para prosseguir",
  equipamento_analise: "o equipamento precisou ser retirado para análise técnica",
  material_fabricacao: "o serviço depende de material que precisa ser fabricado",
  outro: "o serviço não pôde ser concluído nesta visita",
};

const PROXIMO_PASSO: Record<PendenciaCategoria, string> = {
  falta_material: "Assim que o material estiver disponível, faremos o retorno para a conclusão.",
  // Único que devolve a ação pro cliente, de propósito.
  aguardando_gestao: "Aguardamos o retorno de vocês para que possamos agendar a conclusão.",
  equipamento_analise: "Retornaremos com o parecer técnico e o encaminhamento da solução.",
  material_fabricacao: "Faremos o retorno para a conclusão assim que o material estiver pronto.",
  outro: "Faremos o retorno para a conclusão.",
};

export function mensagemPendencia(
  categoria: PendenciaCategoria,
  descricao?: string | null,
  comSaudacao: Saudacao = saudacao(),
): string {
  const detalhe = descricao?.trim();
  return montar([
    `${comSaudacao}.`,
    `Informo que a equipe esteve na residência, porém ${MOTIVO[categoria]}. Segue em anexo o registro do atendimento.`,
    detalhe ? `Detalhe do atendimento: ${detalhe}` : null,
    PROXIMO_PASSO[categoria],
    ASSINATURA,
  ]);
}

// Revisão (0047) é um terceiro ato de fala, diferente dos dois de cima: a
// equipe esteve lá, mas foi uma VISTORIA — o serviço em si ainda não foi
// executado, e o chamado não pode ser finalizado no TomTicket junto (mesma
// regra da pendência: fechar seria mentira, o trabalho continua em aberto).
export function mensagemRevisao(descricao?: string | null, comSaudacao: Saudacao = saudacao()): string {
  const detalhe = descricao?.trim();
  return montar([
    `${comSaudacao}.`,
    "Informo que a equipe esteve na residência e fez a vistoria do chamado. O serviço será realizado em breve — segue o registro da visita em anexo.",
    detalhe ? `Observação da equipe: ${detalhe}` : null,
    ASSINATURA,
  ]);
}

// Reagendamento não tem categoria (o serviço nem chegou a ser executado, ou foi
// cancelado pelo gerente antes da conclusão). Texto genérico — ponto de partida
// editável igual aos outros. Usado na tela de Pendências, que passou a incluir
// os reagendamentos (pedido do usuário, 10/09/2026).
export function mensagemReagendamento(
  descricao?: string | null,
  comSaudacao: Saudacao = saudacao(),
): string {
  const detalhe = descricao?.trim();
  return montar([
    `${comSaudacao}.`,
    "Informo que o atendimento desta demanda não pôde ser concluído na data prevista e será reagendado. Faremos novo agendamento para a conclusão.",
    detalhe ? `Observação: ${detalhe}` : null,
    ASSINATURA,
  ]);
}

// -----------------------------------------------------------------------------
// Respostas automáticas de prazo (24h / 48h)
//
// A CSM posta esses avisos no chamado assim que a demanda chega. NÃO devem
// disparar o aviso de "mensagem nova" pro gerente (pedido do usuário,
// 10/09/2026) — são ruído previsível, não comunicação do cliente que precise de
// atenção. `ehRespostaAutomaticaIgnorada` é aplicada tanto na coleta
// (lib/tomticket/coletor.ts, marca a resposta como já vista) quanto no toast
// do client, como segunda camada.
// -----------------------------------------------------------------------------
export const RESPOSTAS_AUTOMATICAS_IGNORADAS = [
  "A demanda possui prazo de até 24 horas para atendimento e já foi direcionada à equipe de manutenção. Considerando que o chamado foi aberto no dia de hoje, reforço a necessidade de priorização para que o reparo seja realizado dentro do prazo estabelecido.\n\nPermaneço à disposição.",
  "A demanda possui prazo de até 48 horas para atendimento e já foi devidamente direcionada à equipe de manutenção.\n\nPermaneço à disposição.",
];

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // tira acento
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function ehRespostaAutomaticaIgnorada(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const alvo = normalizarTexto(texto);
  if (!alvo) return false;
  return RESPOSTAS_AUTOMATICAS_IGNORADAS.some((padrao) => {
    // Compara pelo miolo distintivo normalizado — tolera pequena edição de
    // pontuação/espaço sem casar com qualquer frase parecida.
    const nucleo = normalizarTexto(padrao).slice(0, 90);
    return nucleo.length > 0 && alvo.includes(nucleo);
  });
}
