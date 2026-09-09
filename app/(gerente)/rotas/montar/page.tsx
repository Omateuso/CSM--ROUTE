import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeSlaStatus } from "@/lib/sla";
import { sugerirProximasRts, type RtParaRoteirizacao } from "@/lib/routing/intelligent-route";
import { MontarRotaClient } from "./montar-rota-client";

// Mesma situação das demais telas: sem Database types gerados ainda, embed
// aninhado fica ambíguo pro TypeScript (array vs objeto único), embora em
// runtime seja sempre objeto único (FK to-one).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const STATUS_ABERTO = new Set(["aberto", "em_andamento"]);

export default async function MontarRotaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gerente") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          Essa página é exclusiva do perfil gerente.
        </p>
      </div>
    );
  }

  const [
    { data: regioesRaw, error: regioesError },
    { data: rtsRaw, error: rtsError },
    { data: chamadosRaw, error: chamadosError },
    { data: equipesRaw, error: equipesError },
    { data: tecnicosRaw, error: tecnicosError },
  ] = await Promise.all([
    supabase.from("regioes").select("id, nome, zonas(nome)").order("nome", { ascending: true }),
    supabase
      .from("rts")
      .select("id, codigo, nome, endereco, latitude, longitude, regiao_id, ativo")
      .eq("ativo", true),
    // Só o que alimenta o resumo por RT (volume/prioridade/SLA no card de
    // candidata). A escolha manual de chamados por técnico (0033) foi removida
    // em 09/09/2026 — o técnico recebe todos os chamados em aberto da RT.
    supabase.from("chamados").select("id, rt_id, prioridade, status, sla_prazo"),
    supabase.from("equipes").select("id, nome").eq("ativo", true).order("nome", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, nome, equipe_id, ativo")
      .eq("role", "tecnico")
      .order("nome", { ascending: true }),
  ]);

  if (regioesError || rtsError || chamadosError || equipesError || tecnicosError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados (
          {regioesError?.message ??
            rtsError?.message ??
            chamadosError?.message ??
            equipesError?.message ??
            tecnicosError?.message}
          ).
        </p>
      </div>
    );
  }

  const equipes = (equipesRaw ?? []).map((e) => ({ id: e.id as string, nome: e.nome as string }));

  const tecnicos = (tecnicosRaw ?? []).map((t) => ({
    id: t.id as string,
    nome: t.nome as string,
    equipeId: t.equipe_id as string | null,
    ativo: t.ativo as boolean,
  }));

  const regioes = (regioesRaw ?? []).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
    zonaNome: unwrapOne(r.zonas)?.nome ?? "—",
  }));

  const porRt = new Map<
    string,
    { total: number; emergencial: number; alta: number; vencido: number; proximo: number }
  >();
  for (const c of chamadosRaw ?? []) {
    if (!STATUS_ABERTO.has(c.status as string)) continue;
    const chave = c.rt_id as string;
    const atual = porRt.get(chave) ?? { total: 0, emergencial: 0, alta: 0, vencido: 0, proximo: 0 };
    atual.total++;
    if (c.prioridade === "emergencial") atual.emergencial++;
    if (c.prioridade === "alta") atual.alta++;
    const slaStatus = computeSlaStatus(c.sla_prazo as string | null);
    if (slaStatus === "vencido") atual.vencido++;
    if (slaStatus === "proximo") atual.proximo++;
    porRt.set(chave, atual);
  }

  const rts: RtParaRoteirizacao[] = (rtsRaw ?? []).map((r) => {
    const resumo = porRt.get(r.id as string) ?? {
      total: 0,
      emergencial: 0,
      alta: 0,
      vencido: 0,
      proximo: 0,
    };
    return {
      id: r.id as string,
      codigo: r.codigo as string,
      nome: r.nome as string,
      endereco: r.endereco as string,
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      regiaoId: r.regiao_id as string,
      totalAbertos: resumo.total,
      emergenciais: resumo.emergencial,
      altas: resumo.alta,
      vencidos: resumo.vencido,
      proximos: resumo.proximo,
    };
  });

  // sugestão inicial calculada aqui no server (mesma função usada pela
  // API /api/rotas/sugestao) — evita buscar no client só de montar a
  // tela, e evita ter que disparar setState de dentro de um useEffect.
  const sugestaoInicial = await sugerirProximasRts({
    todasRts: rts,
    referenciaRtId: null,
    regiaoId: null,
    jaSelecionadas: [],
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-6 pt-12 pb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Rotas</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Montar rota</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Escolha as RTs da rota de hoje. A cada escolha, o sistema sugere as
          melhores próximas opções — a decisão final é sempre sua.
        </p>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-6 pb-12">
        <MontarRotaClient
          regioes={regioes}
          rts={rts}
          equipes={equipes}
          tecnicos={tecnicos}
          candidatasIniciais={sugestaoInicial.candidatas}
          nucleoInicial={sugestaoInicial.nucleo}
        />
      </div>
    </div>
  );
}
