// Agendamento da coleta do TomTicket.
//
// `register()` roda UMA vez quando o servidor sobe (hook nativo do Next), e é
// onde o timer da sincronização é armado. Vale pro `next dev` e pra qualquer
// host de processo longo (VPS, container, `next start`).
//
// NÃO vale pra serverless (Vercel), onde não existe processo vivo entre as
// requisições — lá o caminho é o Vercel Cron batendo em
// `POST /api/tomticket/sync` com o header `x-sync-secret`. O `vercel.json`
// já deixa isso pronto; este arquivo cobre o "enquanto roda na máquina".

const PADRAO_MINUTOS = 5;

export async function register() {
  // Só no runtime Node: o Edge não tem timer longo, e durante o build o
  // `register` também é chamado — sincronizar ali seria escrita no banco em
  // tempo de compilação.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const minutos = Number(process.env.SYNC_INTERVALO_MINUTOS ?? PADRAO_MINUTOS);
  if (!Number.isFinite(minutos) || minutos <= 0) {
    console.log("[sync] agendamento desligado (SYNC_INTERVALO_MINUTOS <= 0).");
    return;
  }
  if (!process.env.TOMTICKET_TOKEN?.trim()) {
    console.log("[sync] agendamento não armado: falta TOMTICKET_TOKEN.");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { sincronizarChamados } = await import("@/lib/tomticket/coletor");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.log("[sync] agendamento não armado: falta a service role do Supabase.");
    return;
  }

  // O agendador roda com service role porque não há usuário logado. É o mesmo
  // caminho que `fn_atualizar_servicos_rota` reconhece via `auth.role()`.
  const supabase = createClient(url, chave, { auth: { persistSession: false } });

  // Uma passada pode levar minutos (limite de 3 req/s da API). Sem esta trava,
  // um ciclo lento faria os seguintes empilharem e disputarem as mesmas linhas.
  let rodando = false;

  async function rodar() {
    if (rodando) {
      console.log("[sync] passada anterior ainda rodando — pulei esta.");
      return;
    }
    rodando = true;
    try {
      const r = await sincronizarChamados(supabase);
      console.log(
        `[sync] ${r.lidos} lidos, ${r.novos} novos, ${r.atualizados} atualizados` +
          `, ${r.servicosCriados} serviço(s) em rota confirmada` +
          (r.respostasNovas ? `, ${r.respostasNovas} resposta(s) de cliente` : "") +
          (r.anexosBaixados ? `, ${r.anexosBaixados} anexo(s) baixado(s)` : "") +
          (r.ignorados ? `, ${r.ignorados} sem RT` : ""),
      );
    } catch (erro) {
      // Nunca derruba o servidor: a coleta falhar é um problema de integração,
      // não motivo pra tirar a aplicação do ar. O relógio não avança, então a
      // próxima passada relê a mesma janela.
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      console.error("[sync] falhou:", mensagem);
      await supabase
        .from("sync_estado")
        .update({ ultima_execucao: new Date().toISOString(), ultimo_erro: mensagem })
        .eq("id", true);
    } finally {
      rodando = false;
    }
  }

  console.log(`[sync] agendada a cada ${minutos} min.`);
  const timer = setInterval(rodar, minutos * 60 * 1000);
  // Não segura o processo vivo só por causa do timer.
  timer.unref?.();

  // Primeira passada logo após a subida, sem esperar o intervalo inteiro.
  setTimeout(rodar, 15_000).unref?.();
}
