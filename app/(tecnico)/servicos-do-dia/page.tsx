import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/logout-button";
import { ServicosDoDiaLista, type ServicoItem } from "./servicos-do-dia-lista";
import type { Prioridade } from "@/app/chamados/prioridade-badge";
import type { StatusServico } from "../status-servico-badge";

// Mesma situação das demais telas: sem Database types gerados ainda, embed
// aninhado fica ambíguo pro TypeScript (array vs objeto único), embora em
// runtime seja sempre objeto único (FK to-one).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function ServicosDoDiaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("nome, role").eq("id", user.id).single();
  if (profile?.role !== "tecnico") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva do perfil técnico.</p>
      </div>
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);

  const { data: servicosRaw, error: servicosError } = await supabase
    .from("servicos")
    .select(
      "id, status, rota_id, rt_id, chamado_id, rotas!inner(data), chamados(assunto, prioridade, sla_prazo, status, tomticket_id, criado_em), rts(codigo, nome, endereco, latitude, longitude)",
    )
    .eq("tecnico_id", user.id)
    // Hoje EM DIANTE (não só hoje): o técnico precisa enxergar a rota de
    // amanhã pra se organizar, e a lista agrupa por dia. Rota passada fica de
    // fora — o que ficou parado lá vira reagendamento do gerente, não trabalho
    // silencioso na tela de quem está em campo.
    .gte("rotas.data", hoje)
    // Rota cancelada não aparece, mesmo que algum serviço dela tenha
    // escapado do cancelamento. Filtrar só por `servicos.status` fazia a
    // tela depender de os dois estados estarem sempre coerentes.
    .neq("rotas.status", "cancelada")
    // `cancelado`/`validado` são terminais pro técnico. `concluido_tecnico`
    // também sai da lista (decisão do usuário, 10/09/2026): assim que o
    // técnico conclui, a responsabilidade passa 100% pro gerente ("Aguardando
    // validação") — deixar o card aqui só empilhava trabalho pronto no meio
    // do que ainda falta.
    .not("status", "in", "(cancelado,validado,concluido_tecnico)");

  if (servicosError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">Não foi possível carregar seus serviços ({servicosError.message}).</p>
      </div>
    );
  }

  const rotaIds = [...new Set((servicosRaw ?? []).map((s) => s.rota_id as string))];
  const { data: rotaRtsRaw } =
    rotaIds.length > 0
      ? await supabase.from("rota_rts").select("rota_id, rt_id, ordem").in("rota_id", rotaIds)
      : { data: [] as { rota_id: string; rt_id: string; ordem: number }[] };
  const ordemPorParada = new Map(
    (rotaRtsRaw ?? []).map((r) => [`${r.rota_id}-${r.rt_id}`, r.ordem as number]),
  );

  // Chamado que já teve um serviço CANCELADO antes (pendência ou
  // reagendamento) e agora está de volta = reexecução. O técnico precisa
  // saber que não é a primeira visita.
  const chamadoIds = [...new Set((servicosRaw ?? []).map((s) => s.chamado_id as string))];
  const chamadosComTentativaAnterior = new Set<string>();
  if (chamadoIds.length > 0) {
    const { data: canceladosRaw } = await supabase
      .from("servicos")
      .select("chamado_id")
      .in("chamado_id", chamadoIds)
      .eq("status", "cancelado");
    for (const s of canceladosRaw ?? []) chamadosComTentativaAnterior.add(s.chamado_id as string);
  }

  const servicos: ServicoItem[] = (servicosRaw ?? [])
    .map((s) => {
      const chamado = unwrapOne(s.chamados);
      const rt = unwrapOne(s.rts);
      return {
        id: s.id as string,
        status: s.status as StatusServico,
        reexecucao: chamadosComTentativaAnterior.has(s.chamado_id as string),
        ordem: ordemPorParada.get(`${s.rota_id}-${s.rt_id}`) ?? 999,
        rotaData: unwrapOne(s.rotas)?.data as string,
        rtCodigo: rt?.codigo as string,
        rtNome: rt?.nome as string,
        rtEndereco: rt?.endereco as string,
        rtLat: rt?.latitude == null ? null : Number(rt.latitude),
        rtLng: rt?.longitude == null ? null : Number(rt.longitude),
        assunto: chamado?.assunto as string,
        protocolo: (chamado?.tomticket_id as string | null) ?? null,
        criadoEm: chamado?.criado_em as string,
        prioridade: chamado?.prioridade as Prioridade,
        slaPrazo: (chamado?.sla_prazo as string | null) ?? null,
        chamadoStatus: chamado?.status as ServicoItem["chamadoStatus"],
      };
    })
    .sort((a, b) => (a.rotaData === b.rotaData ? a.ordem - b.ordem : a.rotaData.localeCompare(b.rotaData)));

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 pt-8 pb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">
            {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(new Date())}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-text-primary">Meus serviços</h1>
          <p className="mt-1 text-sm text-text-secondary">Olá, {profile?.nome ?? "técnico"}</p>
        </div>
        <LogoutButton />
      </header>

      <ServicosDoDiaLista servicos={servicos} hoje={hoje} />
    </div>
  );
}
