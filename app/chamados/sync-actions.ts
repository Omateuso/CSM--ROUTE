"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ErroTomTicket } from "@/lib/tomticket/client";
import { tomticketConfigurado } from "@/lib/tomticket/config";
import { sincronizarChamados } from "@/lib/tomticket/coletor";

// Puxa os chamados direto do TomTicket, substituindo o import por planilha.
//
// Roda como o GERENTE LOGADO, não com service role: as policies de `chamados`
// (0002/0009) e das tabelas de sync (0030) já dão o acesso necessário, e assim
// a RLS continua valendo em vez de ser contornada. Quando a app for pro ar e
// isso virar cron (sem usuário), aí sim precisa de outro caminho de auth.

export type SyncState = {
  error: string | null;
  resumo: string | null;
};

// A constante do estado inicial vive no componente, não aqui: um arquivo
// "use server" só pode exportar FUNÇÃO ASSÍNCRONA — exportar um objeto quebra
// o carregador de server actions do Next em tempo de execução.

export async function sincronizarComTomticket(): Promise<SyncState> {
  if (!tomticketConfigurado()) {
    return {
      error: "Falta configurar o token do TomTicket (TOMTICKET_TOKEN) pra sincronizar.",
      resumo: null,
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre de novo.", resumo: null };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gerente") {
    return { error: "Só o gerente pode sincronizar com o TomTicket.", resumo: null };
  }

  try {
    const r = await sincronizarChamados(supabase, { completa: true });

    revalidatePath("/chamados");
    revalidatePath("/dashboard");
    revalidatePath("/painel");

    const partes = [
      `${r.lidos} chamado(s) lidos`,
      `${r.novos} novo(s)`,
      `${r.atualizados} atualizado(s)`,
    ];
    if (r.ignorados > 0) partes.push(`${r.ignorados} sem RT correspondente`);
    if (r.servicosCriados > 0) {
      partes.push(`${r.servicosCriados} já entraram numa rota confirmada`);
    }
    if (r.resgatados > 0) {
      partes.push(`${r.resgatados} aberto(s) antigo(s) resgatado(s) — fora da janela de 90 dias`);
    }
    if (r.reconciliados > 0) {
      partes.push(`${r.reconciliados} encerrado(s) — sumiram do TomTicket`);
    }

    return { error: null, resumo: `${partes.join(", ")}.` };
  } catch (erro) {
    const mensagem = erro instanceof ErroTomTicket || erro instanceof Error ? erro.message : String(erro);

    // Registra a falha SEM avançar `ultima_leitura` — a próxima passada precisa
    // reler a mesma janela, senão o que mudou durante a falha fica invisível.
    await supabase
      .from("sync_estado")
      .update({ ultima_execucao: new Date().toISOString(), ultimo_erro: mensagem })
      .eq("id", true);

    revalidatePath("/chamados");
    return { error: `Não consegui sincronizar: ${mensagem}`, resumo: null };
  }
}
