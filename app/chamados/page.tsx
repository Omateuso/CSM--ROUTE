import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChamadosManager, type ChamadoRow } from "./chamados-manager";
import { type HistoricoEvento } from "@/lib/ui/historico-chamado";

// Mesma situação do app/(gestao)/rts/page.tsx: sem Database types gerados
// ainda, embeds aninhados (chamados.rts / rts.regioes / regioes.zonas)
// ficam ambíguos pro TypeScript (array vs objeto único), embora em runtime
// sejam sempre objeto único (FK to-one).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ChamadosPage() {
  const supabase = await createClient();

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
  // de 16/08/2026, ver Atualizações_futuras.md): no fluxo real, quem cria
  // chamado é o cliente/CAPS no TomTicket — o gerente não deveria precisar
  // originar chamados manualmente. A exceção é a gestão em visita a uma RT,
  // que pode identificar um problema in loco e já registrar. O gerente
  // mantém a permissão no banco (migration 0002) — só a UI fica pausada até
  // a gestão validar esse fluxo.
  const podeCriar = role === "gestao";

  const [
    { data: chamadosRaw, error: chamadosError },
    { data: rtsRaw, error: rtsError },
  ] = await Promise.all([
    supabase
      .from("chamados")
      .select(
        "id, tomticket_id, rt_id, assunto, descricao, prioridade, status, sla_prazo, criado_em, rts(codigo, nome, regioes(nome, zonas(nome)))",
      )
      .order("criado_em", { ascending: false }),
    supabase
      .from("rts")
      .select("id, codigo, endereco, regioes(nome, zonas(nome))")
      .order("codigo", { ascending: true }),
  ]);

  if (chamadosError || rtsError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados ({chamadosError?.message ?? rtsError?.message}).
        </p>
      </div>
    );
  }

  // Parte E adiantada (ver lib/ui/historico-chamado.tsx): busca a tabela
  // inteira em vez de filtrar por `in (chamado_id...)` — com ~1000
  // chamados esse filtro viraria uma URL gigante (cada uuid ~36 chars);
  // a tabela historico em si é bem menor (só chamado que entrou numa rota
  // gera evento), então trazer tudo e agrupar em JS é mais simples e leve.
  const { data: historicoRaw } = await supabase
    .from("historico")
    .select("id, chamado_id, evento, descricao, criado_em, criado_por:criado_por(nome)")
    .order("criado_em", { ascending: true });

  const historicoPorChamado = new Map<string, HistoricoEvento[]>();
  for (const h of historicoRaw ?? []) {
    const chave = h.chamado_id as string;
    const lista = historicoPorChamado.get(chave) ?? [];
    lista.push({
      id: h.id as string,
      evento: h.evento as string,
      descricao: h.descricao as string | null,
      criadoEm: h.criado_em as string,
      criadoPorNome: unwrapOne(h.criado_por)?.nome ?? null,
    });
    historicoPorChamado.set(chave, lista);
  }

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
      descricao: c.descricao as string | null,
      prioridade: c.prioridade as ChamadoRow["prioridade"],
      status: c.status as ChamadoRow["status"],
      slaPrazo: c.sla_prazo as string | null,
      criadoEm: c.criado_em as string,
      historico: historicoPorChamado.get(c.id as string) ?? [],
    };
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">
          Cadastro
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Chamados</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Entrada manual de chamados — origem TomTicket, com prioridade, SLA e
          RT vinculada. A sincronização automática fica para a Fase 5.
        </p>
      </header>

      <ChamadosManager chamados={chamados} rts={rts} podeCriar={podeCriar} />
    </div>
  );
}
