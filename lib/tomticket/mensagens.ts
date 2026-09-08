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
