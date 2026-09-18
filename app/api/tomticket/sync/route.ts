import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { tomticketConfigurado } from "@/lib/tomticket/config";
import { sincronizarChamados } from "@/lib/tomticket/coletor";

// Coleta do TomTicket por HTTP. Existe por dois motivos:
//
//   1. É o que um agendador (Vercel Cron, Task Scheduler) chama — um cron não
//      tem sessão de usuário, então autentica por segredo compartilhado.
//   2. Um Server Action é abortado pelo runtime se demorar demais, e a coleta
//      pode passar de um minuto (limite de 3 req/s da API). Numa Route Handler
//      o trabalho longo roda até o fim.
//
// Duas formas de autenticar:
//   - header `x-sync-secret` batendo com SYNC_SECRET  -> roda com service role
//   - sessão de gerente logado                        -> roda como ele (RLS vale)

export const maxDuration = 800;

export async function POST(request: Request) {
  if (!tomticketConfigurado()) {
    return NextResponse.json(
      { error: "Falta configurar o TOMTICKET_TOKEN." },
      { status: 503 },
    );
  }

  const segredo = process.env.SYNC_SECRET?.trim();
  const enviado = request.headers.get("x-sync-secret")?.trim();
  const porSegredo = Boolean(segredo) && enviado === segredo;

  let supabase;

  if (porSegredo) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !chave) {
      return NextResponse.json({ error: "Service role não configurada." }, { status: 503 });
    }
    supabase = createServiceClient(url, chave, { auth: { persistSession: false } });
  } else {
    supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "gerente") {
      return NextResponse.json({ error: "Só o gerente pode sincronizar." }, { status: 403 });
    }
  }

  // `?completa=1` força a leitura completa dos abertos (resgate dos antigos +
  // reconciliação) sem esperar a hora — pra rodar à mão quando precisar.
  const completa = new URL(request.url).searchParams.get("completa") === "1";

  try {
    const resultado = await sincronizarChamados(supabase, { completa });
    return NextResponse.json({ ok: true, ...resultado });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    await supabase
      .from("sync_estado")
      .update({ ultima_execucao: new Date().toISOString(), ultimo_erro: mensagem })
      .eq("id", true);
    return NextResponse.json({ ok: false, error: mensagem }, { status: 500 });
  }
}
