import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChamadosManager, type ChamadoRow } from "./chamados-manager";
import { buscarDetalheChamado, type DetalheChamado } from "./actions";
import { SyncTomticketButton, type SyncInfo } from "./sync-tomticket-button";
import { tomticketConfigurado } from "@/lib/tomticket/config";

// Mesma situação do app/(gestao)/rts/page.tsx: sem Database types gerados
// ainda, embeds aninhados (chamados.rts / rts.regioes / regioes.zonas)
// ficam ambíguos pro TypeScript (array vs objeto único), embora em runtime
// sejam sempre objeto único (FK to-one).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ChamadosPage(props: PageProps<"/chamados">) {
  const supabase = await createClient();

  // Deep-link do toast de "nova mensagem" (app/novas-respostas-toast.tsx): abre
  // direto o modal de detalhe desse chamado.
  const searchParams = await props.searchParams;
  const chamadoIdInicial = typeof searchParams.chamado === "string" ? searchParams.chamado : null;
  // Carimbo do clique no toast (ver app/novas-respostas-toast.tsx): entra na
  // `key` pra reabrir o modal quando o MESMO chamado chega de novo.
  const aberturaInicial = typeof searchParams.t === "string" ? searchParams.t : "";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (role !== "gerente" && role !== "gestao") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          Essa página é exclusiva dos perfis gerente e gestão.
        </p>
      </div>
    );
  }

  // "+ Novo chamado" fica habilitado só pra gestão por enquanto (decisão
  // de 16/08/2026, ver docs/atualizacoes-futuras.md): no fluxo real, quem cria
  // chamado é o cliente/CAPS no TomTicket — o gerente não deveria precisar
  // originar chamados manualmente. A exceção é a gestão em visita a uma RT,
  // que pode identificar um problema in loco e já registrar. O gerente
  // mantém a permissão no banco (migration 0002) — só a UI fica pausada até
  // a gestão validar esse fluxo.
  const podeCriar = role === "gestao";
  // Só o gerente responde o cliente pelo modal de detalhe (item 8, 10/09/2026)
  // — mesma regra do fluxo de resposta na Validação/Pendências.
  const podeResponder = role === "gerente";

  const [
    { data: chamadosRaw, error: chamadosError },
    { data: rtsRaw, error: rtsError },
    { data: respostasNovasRaw },
  ] = await Promise.all([
    supabase
      .from("chamados")
      .select(
        "id, tomticket_id, rt_id, assunto, prioridade, status, sla_prazo, criado_em, rts(codigo, nome, regioes(nome, zonas(nome)))",
      )
      .order("criado_em", { ascending: false }),
    supabase
      .from("rts")
      .select("id, codigo, endereco, regioes(nome, zonas(nome))")
      .order("codigo", { ascending: true }),
    // Fase 3 — chamados com resposta de cliente ainda não vista (0036).
    supabase.from("chamado_respostas").select("chamado_id").eq("tipo", "cliente").is("visto_em", null),
  ]);

  const comRespostaNova = new Set((respostasNovasRaw ?? []).map((r) => r.chamado_id as string));

  if (chamadosError || rtsError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados ({chamadosError?.message ?? rtsError?.message}).
        </p>
      </div>
    );
  }

  // A linha do tempo e a mensagem do chamado NÃO vêm mais aqui: eram lidas só
  // dentro do modal, mas viajavam pros ~300 chamados de uma vez, inflando o
  // HTML da tela e o payload de hidratação. Agora `buscarDetalheChamado`
  // (actions.ts) busca as duas quando o modal abre, de um chamado só.
  const rts = (rtsRaw ?? [])
    .map((rt) => {
      const regiao = unwrapOne(rt.regioes);
      return {
        id: rt.id as string,
        codigo: rt.codigo as string,
        endereco: rt.endereco as string,
        regiaoNome: regiao?.nome ?? "—",
        zonaNome: unwrapOne(regiao?.zonas)?.nome ?? "—",
      };
    })
    // .order("codigo") no Postgres ordena como texto ("SRT 10" antes de
    // "SRT 2") — no seletor de RT do formulário de chamado isso atrapalha
    // a busca visual dentro de cada zona. Ordena pelo número, não pela
    // string.
    .sort((a, b) => {
      const numA = parseInt(a.codigo.replace(/\D/g, ""), 10);
      const numB = parseInt(b.codigo.replace(/\D/g, ""), 10);
      return numA - numB;
    });

  const chamados: ChamadoRow[] = (chamadosRaw ?? []).map((c) => {
    const rt = unwrapOne(c.rts);
    const regiao = rt ? unwrapOne(rt.regioes) : null;
    return {
      id: c.id as string,
      tomticketId: c.tomticket_id as string | null,
      rtId: c.rt_id as string,
      rtCodigo: rt?.codigo ?? "—",
      rtNome: rt?.nome ?? "—",
      regiaoNome: regiao?.nome ?? "—",
      zonaNome: unwrapOne(regiao?.zonas)?.nome ?? "—",
      assunto: c.assunto as string,
      prioridade: c.prioridade as ChamadoRow["prioridade"],
      status: c.status as ChamadoRow["status"],
      slaPrazo: c.sla_prazo as string | null,
      criadoEm: c.criado_em as string,
      temRespostaNova: comRespostaNova.has(c.id as string),
    };
  });

  // Estado da coleta (0030). Sem isto, a sync pode morrer e a tela seguir
  // mostrando a última foto sem ninguém perceber.
  const [{ data: estadoSync }, { count: naoImportados }] = await Promise.all([
    supabase.from("sync_estado").select("ultima_leitura, ultima_execucao, ultimo_erro").eq("id", true).maybeSingle(),
    supabase.from("sync_nao_importados").select("tomticket_id", { count: "exact", head: true }),
  ]);

  const syncInfo: SyncInfo = {
    ultimaLeitura: (estadoSync?.ultima_leitura as string | null) ?? null,
    ultimaExecucao: (estadoSync?.ultima_execucao as string | null) ?? null,
    ultimoErro: (estadoSync?.ultimo_erro as string | null) ?? null,
    naoImportados: naoImportados ?? 0,
  };

  // Veio do toast com ?chamado=<id>: já busca o detalhe aqui (server) e marca as
  // respostas do cliente como vistas — o modal abre pronto, sem efeito no client
  // (evita a regra react-hooks/set-state-in-effect).
  let detalheInicial: DetalheChamado | null = null;
  if (chamadoIdInicial && chamados.some((c) => c.id === chamadoIdInicial)) {
    detalheInicial = await buscarDetalheChamado(chamadoIdInicial);
    await supabase.rpc("fn_marcar_respostas_vistas", { p_chamado_id: chamadoIdInicial });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        {/* max-w no texto: sem isso a descrição ocupa a linha inteira e empurra
            o botão de sincronizar pra baixo, desalinhado. */}
        <div className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">
            Cadastro
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">Chamados</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Espelho dos chamados do TomTicket, com prioridade, SLA e RT vinculada.
            Sincronizar traz os chamados novos e atualiza o status dos que já estão aqui.
          </p>
        </div>
        {role === "gerente" && (
          <SyncTomticketButton info={syncInfo} ativo={tomticketConfigurado()} />
        )}
      </header>

      <ChamadosManager
        key={chamadoIdInicial ? `${chamadoIdInicial}-${aberturaInicial}` : "lista"}
        chamados={chamados}
        rts={rts}
        podeCriar={podeCriar}
        podeResponder={podeResponder}
        chamadoIdInicial={chamadoIdInicial}
        detalheInicial={detalheInicial}
      />
    </div>
  );
}
