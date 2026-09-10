"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { montarAnexos, type EvidenciaParaAnexo } from "@/lib/tomticket/anexos";
import {
  ErroTomTicket,
  finalizarChamado,
  lerReplies,
  resolverTicketId,
  responderComoOperador,
  vincularAtendente,
} from "@/lib/tomticket/client";
import { TOMTICKET_MAX_MENSAGEM, tomticketConfigurado } from "@/lib/tomticket/config";
import { formatarDataTomTicket } from "@/lib/tomticket/datas";
import {
  mensagemConclusao,
  mensagemPendencia,
  mensagemReagendamento,
  SAUDACOES,
  type Saudacao,
} from "@/lib/tomticket/mensagens";
import type { PendenciaCategoria } from "@/lib/ui/pendencia-categoria";

// Responder o chamado no TomTicket direto daqui — o último passo que ainda era
// manual (o gerente abria outra aba, copiava o texto e anexava a OS na mão).
//
// Dois caminhos, decididos pelo tipo:
//
//   conclusão -> vincula o atendente e FINALIZA o chamado, já entregando a
//                mensagem e os anexos numa chamada só (/ticket/finish aceita
//                os dois). O usuário reverteu em 08/09/2026 a decisão anterior
//                de nunca finalizar.
//   pendência -> vincula o atendente e só RESPONDE (/ticket/reply/operator):
//                o trabalho não terminou, fechar seria mentira.

export type RespostaState = { error: string | null; aviso: string | null; ok: boolean };

// Mesma regra: "use server" só exporta função assíncrona. O estado inicial
// fica no componente que o consome.

type TipoResposta = "conclusao" | "pendencia";

// TomTicket guarda a conversa com marcação; comparar texto cru daria falso
// negativo por causa de uma tag. Normaliza dos dois lados antes de comparar.
function normalizar(texto: string): string {
  return texto
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// A "impressão digital" da mensagem: o suficiente pra reconhecê-la na conversa
// sem depender de formatação. Mesma ideia do `conversa_contem` da base.
function assinaturaDaMensagem(mensagem: string): string {
  return normalizar(mensagem).slice(0, 80);
}

function jaEstaNaConversa(replies: { message: string; senderType: string }[], mensagem: string): boolean {
  const alvo = assinaturaDaMensagem(mensagem);
  if (!alvo) return false;
  return replies.some((r) => r.senderType.toUpperCase() === "A" && normalizar(r.message).includes(alvo));
}

function formatarData(iso: string | null): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  return formatarDataTomTicket(data);
}

// A janela de trabalho (start_date/end_date) que acompanha a resposta.
//
// A API exige que o fim seja ESTRITAMENTE maior que o início, e recusa com
// `401 "The end date of work must be greater than the start date."` quando não
// é. Isso acontece de verdade: o formato tem precisão de SEGUNDO, então um
// atendimento que começou e terminou dentro do mesmo segundo (comum em teste,
// e possível em campo num serviço rápido) vira dois carimbos idênticos.
//
// Os dois campos são opcionais e só enriquecem o chamado — então na dúvida a
// resposta vai sem eles, em vez de falhar por causa de um detalhe acessório.
function janelaDeTrabalho(execucao: { iniciado_em?: string | null; concluido_em?: string | null } | null): {
  inicio: string | null;
  fim: string | null;
} {
  const vazio = { inicio: null, fim: null };

  // DESLIGADO POR PADRÃO (08/09/2026). O TomTicket recusa com
  // `401 "The end date of work must be greater than the start date."` mesmo
  // quando o par é comprovadamente válido: conferimos as execuções reais e o
  // fim vem dezenas de segundos DEPOIS do início, no mesmo formato que a
  // própria doc mostra e que o filtro `last_update_ge` aceita. A validação da
  // API acontece só depois de achar o ticket, então não dá pra sondar o
  // formato sem escrever num chamado real.
  //
  // Como esses dois campos são OPCIONAIS e só enriquecem o chamado, eles não
  // podem derrubar o que importa (a resposta com os anexos). Ficam atrás de um
  // interruptor: `TOMTICKET_ENVIAR_HORARIO=1` religa quando/se descobrirmos o
  // que a API espera de fato — provavelmente uma pergunta pro suporte deles.
  if (process.env.TOMTICKET_ENVIAR_HORARIO?.trim() !== "1") return vazio;
  const inicioIso = execucao?.iniciado_em ?? null;
  const fimIso = execucao?.concluido_em ?? null;
  if (!inicioIso || !fimIso) return vazio;

  const inicio = new Date(inicioIso);
  const fim = new Date(fimIso);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return vazio;

  // Compara em segundos, que é a precisão que o TomTicket vai receber.
  if (Math.floor(fim.getTime() / 1000) <= Math.floor(inicio.getTime() / 1000)) return vazio;

  return { inicio: formatarData(inicioIso), fim: formatarData(fimIso) };
}

function ehTextoPadrao(mensagem: string, gerarPadrao: (s: Saudacao) => string): boolean {
  const alvo = normalizar(mensagem);
  return SAUDACOES.some((s) => normalizar(gerarPadrao(s)) === alvo);
}

type EvidenciaRow = { tipo: string; momento: string | null; storage_path: string };

function ordenarEvidencias(evidencias: EvidenciaRow[], tipo: TipoResposta): EvidenciaParaAnexo[] {
  const relevantes = evidencias.filter((e) =>
    tipo === "conclusao"
      ? e.tipo === "os" || e.momento === "antes" || e.momento === "depois"
      : e.tipo === "os" || e.momento === "parcial",
  );

  // Ordem em que o cliente vê no chamado: o antes/parcial, o depois, a OS.
  const peso = (e: EvidenciaRow) => {
    if (e.tipo === "os") return 3;
    if (e.momento === "depois") return 2;
    return 1;
  };

  return relevantes
    .sort((a, b) => peso(a) - peso(b))
    .map((e) => ({
      storagePath: e.storage_path,
      tipo: e.tipo as EvidenciaParaAnexo["tipo"],
      momento: e.momento as EvidenciaParaAnexo["momento"],
    }));
}

export async function responderChamadoTomticket(
  _prev: RespostaState,
  formData: FormData,
): Promise<RespostaState> {
  const servicoId = String(formData.get("servicoId") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoResposta;
  const mensagem = String(formData.get("mensagem") ?? "").trim();

  if (!servicoId) return { aviso: null, ok: false, error: "Serviço inválido." };
  if (tipo !== "conclusao" && tipo !== "pendencia") {
    return { aviso: null, ok: false, error: "Tipo de resposta inválido." };
  }
  if (!mensagem) return { aviso: null, ok: false, error: "A mensagem não pode ficar vazia." };
  if (mensagem.length > TOMTICKET_MAX_MENSAGEM) {
    return {
      aviso: null,
      ok: false,
      error: `A mensagem tem ${mensagem.length} caracteres e o TomTicket aceita no máximo ${TOMTICKET_MAX_MENSAGEM}.`,
    };
  }
  if (!tomticketConfigurado()) {
    return {
      aviso: null,
      ok: false,
      error:
        "A integração com o TomTicket ainda não foi configurada (falta o token). Responda pelo TomTicket por enquanto.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { aviso: null, ok: false, error: "Sessão expirada. Entre de novo." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gerente") {
    return { aviso: null, ok: false, error: "Só o gerente pode responder um chamado no TomTicket." };
  }

  const { data: servico } = await supabase
    .from("servicos")
    .select(
      "id, status, chamado_id, tomticket_resposta_id, chamados(tomticket_id, tomticket_ticket_id), evidencias(tipo, momento, storage_path), execucoes(iniciado_em, concluido_em)",
    )
    .eq("id", servicoId)
    .single();

  if (!servico) return { aviso: null, ok: false, error: "Serviço não encontrado." };
  if (servico.tomticket_resposta_id) {
    return { aviso: null, ok: false, error: "Esse serviço já foi respondido no TomTicket." };
  }

  const chamado = Array.isArray(servico.chamados) ? servico.chamados[0] : servico.chamados;
  const protocolo = String(chamado?.tomticket_id ?? "").trim();
  if (!protocolo) {
    return { aviso: null, ok: false, error: "Esse chamado não tem protocolo do TomTicket registrado." };
  }

  // Confere se o texto é o padrão — só pro registro no histórico.
  let padrao = false;
  if (tipo === "conclusao") {
    padrao = ehTextoPadrao(mensagem, (s) => mensagemConclusao(s));
  } else {
    // Pendência de verdade (`servico_pendente`, com categoria) ou reagendamento
    // (`servico_reagendado`, sem categoria — texto genérico). Só define o rótulo
    // "padrão vs. escrita pelo gerente" no histórico.
    const { data: evento } = await supabase
      .from("historico")
      .select("evento, categoria, descricao")
      .eq("servico_id", servicoId)
      .in("evento", ["servico_pendente", "servico_reagendado"])
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (evento?.evento === "servico_pendente" && evento.categoria) {
      padrao = ehTextoPadrao(mensagem, (s) =>
        mensagemPendencia(evento.categoria as PendenciaCategoria, evento.descricao, s),
      );
    } else if (evento?.evento === "servico_reagendado") {
      padrao = ehTextoPadrao(mensagem, (s) => mensagemReagendamento(evento.descricao, s));
    }
  }

  try {
    // 1. Resolver o id interno (protocolo != ticket_id), reusando o cache.
    let ticketId = String(chamado?.tomticket_ticket_id ?? "").trim();
    if (!ticketId) {
      const resolvido = await resolverTicketId(protocolo);
      if (!resolvido) {
        return {
          aviso: null,
          ok: false,
          error: `Não achei o chamado #${protocolo} no TomTicket. Confira se o protocolo está certo.`,
        };
      }
      ticketId = resolvido;
      await supabase
        .from("chamados")
        .update({ tomticket_ticket_id: ticketId })
        .eq("id", servico.chamado_id);
    }

    // 2. Trava viva: a conversa AO VIVO já tem essa mensagem? Cobre o caso de
    //    um envio anterior ter chegado no TomTicket e falhado ao gravar aqui.
    const antes = await lerReplies(ticketId);
    if (jaEstaNaConversa(antes, mensagem)) {
      return {
        aviso: null,
        ok: false,
        error:
          "Essa mensagem já aparece na conversa do chamado no TomTicket — não enviei de novo pra não duplicar.",
      };
    }

    // 3. Anexos e envio.
    const evidencias = Array.isArray(servico.evidencias) ? (servico.evidencias as EvidenciaRow[]) : [];
    const anexos = await montarAnexos(supabase, ordenarEvidencias(evidencias, tipo));

    // Vincular o atendente é organização interna do TomTicket — se falhar, a
    // mensagem e os anexos (o que o cliente precisa ver) não podem ser perdidos
    // por causa disso. Por isso o erro é engolido de propósito.
    const operadorId = process.env.TOMTICKET_OPERADOR_ID?.trim();
    if (operadorId) {
      try {
        await vincularAtendente(ticketId, operadorId);
      } catch {
        // segue o fluxo
      }
    }

    const execucao = Array.isArray(servico.execucoes) ? servico.execucoes[0] : servico.execucoes;

    let respostaId: string;
    if (tipo === "conclusao") {
      await finalizarChamado({ ticketId, mensagem, anexos });
      // /ticket/finish não devolve id — o recibo é montado aqui, e serve
      // igualmente como trava de idempotência na 0028.
      respostaId = `finalizado:${new Date().toISOString()}`;
    } else {
      respostaId = await responderComoOperador({
        ticketId,
        mensagem,
        anexos,
        ...janelaDeTrabalho(execucao ?? null),
      });
    }

    // 4. Gravar ANTES de reler. Se a releitura falhar, o pior caso é um aviso
    //    na tela — e não um envio sem registro, que deixaria o próximo clique
    //    duplicar a mensagem no chamado do cliente.
    const { error: erroRegistro } = await supabase.rpc("fn_registrar_resposta_tomticket", {
      p_servico_id: servicoId,
      p_resposta_id: respostaId,
      p_tipo: tipo,
      p_mensagem: mensagem,
      p_padrao: padrao,
    });

    revalidatePath("/validacao");
    revalidatePath("/pendencias");

    if (erroRegistro) {
      return {
        error: null,
        ok: true,
        aviso:
          "A mensagem foi enviada ao TomTicket, mas não consegui registrar isso aqui. " +
          "Confira no chamado antes de enviar de novo.",
      };
    }

    // 5. "O servidor aceitou" e "a mensagem chegou" são coisas diferentes.
    const depois = await lerReplies(ticketId);
    if (!jaEstaNaConversa(depois, mensagem)) {
      return {
        error: null,
        ok: true,
        aviso:
          "O TomTicket aceitou a resposta, mas ela ainda não apareceu na conversa. " +
          "Confira no chamado antes de reenviar.",
      };
    }

    return { error: null, aviso: null, ok: true };
  } catch (erro) {
    if (erro instanceof ErroTomTicket) return { aviso: null, ok: false, error: erro.message };
    return {
      aviso: null,
      ok: false,
      error: `Não consegui responder no TomTicket (${erro instanceof Error ? erro.message : String(erro)}).`,
    };
  }
}
