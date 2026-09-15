import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeSlaStatus } from "@/lib/sla";
import { DashboardRealtime } from "./dashboard-realtime";
import { RtsVolumeSection } from "./rts-volume-section";
import { AtencaoAgoraCard } from "./atencao-agora-card";
import { OperacaoHojeCard } from "@/lib/ui/operacao-hoje-card";

// Mesma situação de app/chamados/page.tsx: sem Database types gerados
// ainda, embed aninhado (chamados.rts) fica ambíguo pro TypeScript (array
// vs objeto único), embora em runtime seja sempre objeto único (FK to-one).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// "Aberto" pro propósito do dashboard = ainda não fechado no TomTicket —
// cobre os dois status que o import real usa hoje (aberto/em_andamento).
// finalizado/cancelado não entram nas métricas de volume atual.
const STATUS_ABERTO = new Set(["aberto", "em_andamento"]);

// `emRevisao` separado de `emExecucao` (pedido do usuário, 15/09/2026 —
// "a conclusão deles é diferente", contado à parte, nunca somado).
type BucketHoje = { pendente: number; emExecucao: number; emRevisao: number; concluido: number };

// Auditoria de design (23/08/2026): rótulo pequeno padronizado acima de
// todo número — parte da escala tipográfica nova (Etapa 4 do plano),
// mais discreto que o `text-xs` genérico que existia antes.
function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-medium tracking-wide text-text-tertiary uppercase">{children}</p>;
}


function ContextoStat({
  label,
  value,
  tom = "neutro",
}: {
  label: string;
  value: number;
  tom?: "neutro" | "emergencial" | "vencido";
}) {
  const cor =
    tom === "emergencial"
      ? "text-priority-emergencial"
      : tom === "vencido"
        ? "text-sla-vencido"
        : "text-text-primary";
  return (
    <div>
      <Rotulo>{label}</Rotulo>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${cor}`}>{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Sessão lida do cookie, sem ida à rede. O proxy.ts (middleware) roda o
  // getUser() autoritativo + refresh do token em TODA requisição desta rota e
  // redireciona quem não está logado — aqui só é preciso o id pra buscar a
  // role, e a RLS é o backstop real por linha. Trocar getUser() (rede) por
  // getSession() (local) corta ~200-400 ms de cada navegação.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (profile?.role !== "gerente") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          Essa página é exclusiva do perfil gerente.
        </p>
      </div>
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);
  // Janela "hoje" em UTC — mesma semântica do antigo `.slice(0, 10) === hoje`,
  // agora aplicada no banco em vez de filtrar linha por linha em JS.
  const inicioDoDia = `${hoje}T00:00:00.000Z`;
  const fimDoDia = `${hoje}T23:59:59.999Z`;

  const [
    { data: chamadosRaw, error },
    { data: servicosHojeRaw, error: servicosHojeError },
    { count: concluidosHojeCount, error: concluidosError },
    { count: reagendadosHojeCount, error: reagendadosError },
    { count: aguardandoValidacaoCount, error: aguardandoValidacaoError },
    { count: travadosCount, error: travadosError },
  ] = await Promise.all([
    // Só os chamados que entram nas métricas de volume — o loop abaixo já
    // descartava finalizado/cancelado em JS. Filtrar no banco evita trazer as
    // centenas de chamados fechados que a sincronização do TomTicket acumula.
    supabase
      .from("chamados")
      .select("id, prioridade, status, sla_prazo, rt_id, rts(codigo, nome)")
      .in("status", ["aberto", "em_andamento"]),
    // "Operação de hoje" — escopado pela rota do dia (planejamento de hoje),
    // não pelo status corrente sem filtro nenhum como era antes.
    supabase
      .from("servicos")
      .select("status, tecnico:tecnico_id(nome), rotas!inner(data, regioes(nome))")
      .eq("rotas.data", hoje),
    // "Concluídos hoje" / "Reagendados hoje" — contagem direta no banco pela
    // data do evento (era: trazer TODOS os serviços concluídos e TODOS os
    // eventos de reagendamento, sem limite, e filtrar o dia em JS).
    supabase
      .from("servicos")
      .select("id", { count: "exact", head: true })
      .gte("concluido_em", inicioDoDia)
      .lte("concluido_em", fimDoDia),
    supabase
      .from("historico")
      .select("id", { count: "exact", head: true })
      .eq("evento", "servico_reagendado")
      .gte("criado_em", inicioDoDia)
      .lte("criado_em", fimDoDia),
    supabase.from("servicos").select("id", { count: "exact", head: true }).eq("status", "concluido_tecnico"),
    supabase
      .from("servicos")
      .select("id, rotas!inner(data)", { count: "exact", head: true })
      .in("status", ["planejado", "em_execucao", "em_revisao"])
      .lt("rotas.data", hoje),
  ]);

  if (
    error ||
    servicosHojeError ||
    concluidosError ||
    reagendadosError ||
    aguardandoValidacaoError ||
    travadosError
  ) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados (
          {error?.message ??
            servicosHojeError?.message ??
            concluidosError?.message ??
            reagendadosError?.message ??
            aguardandoValidacaoError?.message ??
            travadosError?.message}
          ).
        </p>
      </div>
    );
  }

  let totalAbertos = 0;
  let totalCriticos = 0;
  let totalSlaVencido = 0;
  const volumePorRt = new Map<string, { codigo: string; nome: string; total: number }>();

  for (const c of chamadosRaw ?? []) {
    if (!STATUS_ABERTO.has(c.status as string)) continue;

    totalAbertos++;
    if (c.prioridade === "emergencial") totalCriticos++;
    if (computeSlaStatus(c.sla_prazo as string | null) === "vencido") totalSlaVencido++;

    const rt = unwrapOne(c.rts);
    if (rt) {
      const chave = c.rt_id as string;
      const atual = volumePorRt.get(chave);
      if (atual) atual.total++;
      else volumePorRt.set(chave, { codigo: rt.codigo as string, nome: rt.nome as string, total: 1 });
    }
  }

  let naoIniciadosHoje = 0;
  let emExecucaoHoje = 0;
  let emRevisaoHoje = 0;
  const porRegiaoHoje = new Map<string, BucketHoje>();
  const porTecnicoHoje = new Map<string, BucketHoje>();

  for (const s of servicosHojeRaw ?? []) {
    const status = s.status as string;
    if (status === "planejado") naoIniciadosHoje++;
    if (status === "em_execucao") emExecucaoHoje++;
    if (status === "em_revisao") emRevisaoHoje++;
    if (status === "cancelado") continue; // já reagendado — não entra na visão "operação de hoje"

    // `em_revisao` (0053/0054) nunca deve cair no bucket "concluido" por
    // omissão — precisa do próprio ramo, senão um serviço em revisão
    // contaria (errado) como concluído nas tabelas por região/técnico.
    const bucket: keyof BucketHoje =
      status === "planejado"
        ? "pendente"
        : status === "em_execucao"
          ? "emExecucao"
          : status === "em_revisao"
            ? "emRevisao"
            : "concluido";

    const rota = unwrapOne(s.rotas);
    const regiaoNome = unwrapOne(rota?.regioes)?.nome ?? "—";
    const tecnicoNome = unwrapOne(s.tecnico)?.nome ?? "—";

    const bucketVazio = (): BucketHoje => ({ pendente: 0, emExecucao: 0, emRevisao: 0, concluido: 0 });

    const atualRegiao = porRegiaoHoje.get(regiaoNome) ?? bucketVazio();
    atualRegiao[bucket]++;
    porRegiaoHoje.set(regiaoNome, atualRegiao);

    const atualTecnico = porTecnicoHoje.get(tecnicoNome) ?? bucketVazio();
    atualTecnico[bucket]++;
    porTecnicoHoje.set(tecnicoNome, atualTecnico);
  }

  const totalConcluidosHoje = concluidosHojeCount ?? 0;
  const totalReagendadosHoje = reagendadosHojeCount ?? 0;

  const rtsOrdenadas = [...volumePorRt.values()].sort((a, b) => b.total - a.total);
  const maxVolume = rtsOrdenadas[0]?.total ?? 1;

  const regioesOrdenadas = [...porRegiaoHoje.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const tecnicosOrdenados = [...porTecnicoHoje.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const atencaoAgora = (aguardandoValidacaoCount ?? 0) + (travadosCount ?? 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">
            Visão geral
          </p>
          <DashboardRealtime />
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Panorama dos chamados em aberto e da execução em campo de hoje.
        </p>
      </header>

      {/* Atenção agora — foco único da tela: o que o gerente precisa
          resolver antes de qualquer outra coisa. Só ganha o tratamento
          animado (AtencaoAgoraCard) quando há algo pendente — "tudo em
          dia" fica no card neutro simples, sem motivo pra chamar atenção. */}
      {atencaoAgora > 0 ? (
        <AtencaoAgoraCard
          total={atencaoAgora}
          aguardandoValidacao={aguardandoValidacaoCount ?? 0}
          travados={travadosCount ?? 0}
        />
      ) : (
        <div className="rounded-[var(--radius-md)] border border-border bg-surface p-6">
          <Rotulo>Atenção agora</Rotulo>
          <p className="mt-2 text-4xl font-bold tabular-nums text-sla-dentro">0</p>
          <p className="mt-2 text-sm text-text-secondary">
            Nada aguardando validação ou travado — operação em dia.
          </p>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-text-primary">Operação de hoje</h2>
        <p className="mt-1 text-xs text-text-tertiary">
          Serviços das rotas confirmadas pra hoje, por status.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <OperacaoHojeCard label="Não iniciados" value={naoIniciadosHoje} />
          <OperacaoHojeCard label="Em execução" value={emExecucaoHoje} />
          <OperacaoHojeCard label="Em revisão" value={emRevisaoHoje} />
          <OperacaoHojeCard label="Concluídos" value={totalConcluidosHoje} />
          <OperacaoHojeCard label="Reagendados" value={totalReagendadosHoje} />
        </div>
      </section>

      {(regioesOrdenadas.length > 0 || tecnicosOrdenados.length > 0) && (
        <section className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Por região, hoje</h2>
            <div className="mt-3 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
              <table className="w-full min-w-[460px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-text-tertiary">
                    <th scope="col" className="px-4 py-2.5 font-medium">Região</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Pendente</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Em exec.</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Em revisão</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Concluído</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {regioesOrdenadas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-xs text-text-tertiary">
                        Nenhuma rota confirmada pra hoje.
                      </td>
                    </tr>
                  ) : (
                    regioesOrdenadas.map(([nome, b]) => (
                      <tr key={nome}>
                        <td className="px-4 py-2 text-text-primary">{nome}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{b.pendente}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{b.emExecucao}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{b.emRevisao}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{b.concluido}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-text-primary">Por técnico, hoje</h2>
            <div className="mt-3 overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
              <table className="w-full min-w-[460px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-text-tertiary">
                    <th scope="col" className="px-4 py-2.5 font-medium">Técnico</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Pendente</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Em exec.</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Em revisão</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Concluído</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tecnicosOrdenados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-xs text-text-tertiary">
                        Nenhuma rota confirmada pra hoje.
                      </td>
                    </tr>
                  ) : (
                    tecnicosOrdenados.map(([nome, b]) => (
                      <tr key={nome}>
                        <td className="px-4 py-2 text-text-primary">{nome}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{b.pendente}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{b.emExecucao}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{b.emRevisao}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{b.concluido}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-text-primary">RTs com maior volume</h2>
        <p className="mt-1 text-xs text-text-tertiary">
          Chamados em aberto por RT, ordenado do maior pro menor.
        </p>

        <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface">
          {rtsOrdenadas.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-text-tertiary">
              Nenhum chamado em aberto no momento.
            </p>
          ) : (
            <div className="p-4">
              <RtsVolumeSection rts={rtsOrdenadas} maxVolume={maxVolume} />
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap gap-x-10 gap-y-4 rounded-[var(--radius-md)] border border-border bg-surface-input px-5 py-4">
          <ContextoStat label="Chamados abertos" value={totalAbertos} />
          <ContextoStat label="Críticos" value={totalCriticos} tom="emergencial" />
          <ContextoStat label="SLA vencido" value={totalSlaVencido} tom="vencido" />
        </div>
      </section>
    </div>
  );
}
