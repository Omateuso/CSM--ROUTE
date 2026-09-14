import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeSlaStatus } from "@/lib/sla";
import { StatCard } from "@/lib/ui/stat-card";
import { OperacaoHojeCard } from "@/lib/ui/operacao-hoje-card";
import { RegiaoSection } from "./regiao-section";
import { RtsSection } from "./rts-section";
import { PainelRealtime } from "./painel-realtime";

// Mesma situação das demais telas: sem Database types gerados ainda, embed
// aninhado fica ambíguo pro TypeScript (array vs objeto único), embora em
// runtime seja sempre objeto único (FK to-one).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const STATUS_ABERTO = new Set(["aberto", "em_andamento"]);
const STATUS_ROTA_LABEL: Record<string, string> = {
  planejada: "Planejada",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
};

export default async function PainelGestaoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gestao") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva do perfil gestão.</p>
      </div>
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);

  const [
    { data: chamadosRaw, error },
    { data: servicosHojeRaw, error: servicosHojeError },
    { count: aguardandoValidacaoCount, error: aguardandoValidacaoError },
    { count: travadosCount, error: travadosError },
    { data: rotasRecentesRaw, error: rotasError },
  ] = await Promise.all([
    supabase
      .from("chamados")
      .select("id, prioridade, status, sla_prazo, rt_id, rts(codigo, nome, regiao_id, regioes(nome))"),
    supabase.from("servicos").select("status, rotas!inner(data)").eq("rotas.data", hoje),
    supabase.from("servicos").select("id", { count: "exact", head: true }).eq("status", "concluido_tecnico"),
    supabase
      .from("servicos")
      .select("id, rotas!inner(data)", { count: "exact", head: true })
      .in("status", ["planejado", "em_execucao"])
      .lt("rotas.data", hoje),
    supabase
      .from("rotas")
      .select("id, data, status, regioes(nome)")
      .order("data", { ascending: false })
      .order("confirmada_em", { ascending: false })
      .limit(8),
  ]);

  if (error || servicosHojeError || aguardandoValidacaoError || travadosError || rotasError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados (
          {error?.message ??
            servicosHojeError?.message ??
            aguardandoValidacaoError?.message ??
            travadosError?.message ??
            rotasError?.message}
          ).
        </p>
      </div>
    );
  }

  // RTs de cada rota recente — busca à parte porque depende dos ids que
  // vieram no fetch anterior.
  const rotaIds = (rotasRecentesRaw ?? []).map((r) => r.id as string);
  const { data: rotaRtsRaw, error: rotaRtsError } =
    rotaIds.length > 0
      ? await supabase
          .from("rota_rts")
          .select("rota_id, ordem, rts(codigo, endereco)")
          .in("rota_id", rotaIds)
          .order("ordem", { ascending: true })
      : { data: [], error: null };

  if (rotaRtsError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">Não foi possível carregar os dados ({rotaRtsError.message}).</p>
      </div>
    );
  }

  const rtsPorRota = new Map<string, { codigo: string; endereco: string }[]>();
  for (const rr of rotaRtsRaw ?? []) {
    const rt = unwrapOne(rr.rts);
    if (!rt) continue;
    const chave = rr.rota_id as string;
    const lista = rtsPorRota.get(chave) ?? [];
    lista.push({ codigo: rt.codigo as string, endereco: rt.endereco as string });
    rtsPorRota.set(chave, lista);
  }

  let totalAbertos = 0;
  let totalCriticos = 0;
  let totalSlaVencido = 0;
  const porPrioridade = { emergencial: 0, alta: 0, normal: 0, baixa: 0 };
  const porRegiao = new Map<string, { total: number; vencido: number }>();
  const volumePorRt = new Map<string, { codigo: string; nome: string; total: number }>();

  for (const c of chamadosRaw ?? []) {
    if (!STATUS_ABERTO.has(c.status as string)) continue;

    totalAbertos++;
    const prioridade = c.prioridade as keyof typeof porPrioridade;
    porPrioridade[prioridade]++;
    if (prioridade === "emergencial") totalCriticos++;

    const vencido = computeSlaStatus(c.sla_prazo as string | null) === "vencido";
    if (vencido) totalSlaVencido++;

    const rt = unwrapOne(c.rts);
    const regiaoNome = unwrapOne(rt?.regioes)?.nome ?? "—";
    const atualRegiao = porRegiao.get(regiaoNome) ?? { total: 0, vencido: 0 };
    atualRegiao.total++;
    if (vencido) atualRegiao.vencido++;
    porRegiao.set(regiaoNome, atualRegiao);

    if (rt) {
      const chave = c.rt_id as string;
      const atual = volumePorRt.get(chave);
      if (atual) atual.total++;
      else volumePorRt.set(chave, { codigo: rt.codigo as string, nome: rt.nome as string, total: 1 });
    }
  }

  let naoIniciadosHoje = 0;
  let emExecucaoHoje = 0;
  let concluidosHoje = 0;
  for (const s of servicosHojeRaw ?? []) {
    if (s.status === "planejado") naoIniciadosHoje++;
    else if (s.status === "em_execucao") emExecucaoHoje++;
    else if (s.status === "concluido_tecnico" || s.status === "validado") concluidosHoje++;
  }

  const rtsOrdenadas = [...volumePorRt.values()].sort((a, b) => b.total - a.total);
  const regioesOrdenadas = [...porRegiao.entries()].sort((a, b) => b[1].total - a[1].total);

  const formatoData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Visão geral</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">Painel da gestão</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Panorama consolidado, só leitura — chamados, execução e rotas.
          </p>
        </div>
        <PainelRealtime />
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Chamados abertos" value={totalAbertos} />
        <StatCard label="Críticos (emergencial)" value={totalCriticos} tom="emergencial" />
        <StatCard label="SLA vencido" value={totalSlaVencido} tom="vencido" />
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-text-primary">Serviços em execução</h2>
        <p className="mt-1 text-xs text-text-tertiary">
          Retrato de agora: o que falta começar, o que está em campo e onde a operação trava — ação continua com o
          gerente.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <OperacaoHojeCard label="Não iniciados hoje" value={naoIniciadosHoje} />
          <OperacaoHojeCard label="Em execução hoje" value={emExecucaoHoje} />
          <OperacaoHojeCard label="Concluídos hoje" value={concluidosHoje} />
          <OperacaoHojeCard label="Aguardando validação" value={aguardandoValidacaoCount ?? 0} />
          <OperacaoHojeCard label="Travados em rota passada" value={travadosCount ?? 0} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-text-primary">Rotas confirmadas recentes</h2>
        <p className="mt-1 text-xs text-text-tertiary">
          As últimas rotas do pipeline, mais recente primeiro — as de hoje ficam destacadas.
        </p>
        <div className="mt-3 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-text-tertiary">
                <th scope="col" className="px-4 py-2.5 font-medium">Data</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Região</th>
                <th scope="col" className="px-3 py-2.5 font-medium">RTs planejadas</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(rotasRecentesRaw ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-text-tertiary">
                    Nenhuma rota confirmada ainda.
                  </td>
                </tr>
              ) : (
                (rotasRecentesRaw ?? []).map((r) => {
                  const ehHoje = (r.data as string) === hoje;
                  const rts = rtsPorRota.get(r.id as string) ?? [];
                  return (
                    <tr key={r.id as string} className={ehHoje ? "bg-accent/5" : undefined}>
                      <td className="px-4 py-2 align-top whitespace-nowrap text-text-primary">
                        <span className="inline-flex items-center gap-2">
                          {formatoData.format(new Date(`${r.data as string}T00:00:00`))}
                          {ehHoje && (
                            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              Hoje
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top text-text-secondary">{unwrapOne(r.regioes)?.nome ?? "—"}</td>
                      <td className="px-3 py-2 align-top text-text-secondary">
                        {rts.length === 0 ? (
                          "—"
                        ) : (
                          <ul className="flex flex-col gap-0.5">
                            {rts.map((rt, indice) => (
                              <li key={indice} className="text-xs">
                                <span className="font-mono text-text-secondary">{rt.codigo}</span>{" "}
                                <span className="text-text-tertiary">— {rt.endereco}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-text-secondary">
                        {STATUS_ROTA_LABEL[r.status as string] ?? (r.status as string)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-text-primary">Por criticidade</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Emergencial" value={porPrioridade.emergencial} tom="emergencial" />
          <StatCard label="Alta" value={porPrioridade.alta} />
          <StatCard label="Normal" value={porPrioridade.normal} />
          <StatCard label="Baixa" value={porPrioridade.baixa} />
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <RegiaoSection regioes={regioesOrdenadas.map(([nome, r]) => ({ nome, ...r }))} />
        <RtsSection rts={rtsOrdenadas} />
      </section>
    </div>
  );
}
