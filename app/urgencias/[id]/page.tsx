import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarDetalheChamado } from "@/app/chamados/actions";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { StatusChamadoBadge, type StatusChamado } from "@/app/chamados/status-chamado-badge";
import { UrgenciaStatusBadge, derivarStatusDisplay } from "../urgencia-status-badge";
import { URGENCIA_ORIGEM_LABEL, type UrgenciaOrigem } from "../urgencia-origem";
import { UrgenciaAcoes } from "./urgencia-acoes";
import { DecidirAtendimentoPanel } from "./decidir-atendimento-panel";
import type { CandidatoMapa } from "./urgencia-mapa";
import { ProgramarReexecucao, type RotaParaReexecucao } from "@/app/(gerente)/pendencias/programar-reexecucao";
import { HistoricoChamado } from "@/lib/ui/historico-chamado";
import { LightboxImage } from "@/lib/ui/image-lightbox";
import { tomticketSearchUrl } from "@/lib/tomticket/busca";
import { FOCUS_RING } from "@/lib/ui/styles";
import {
  calcularImpactoUrgencia,
  type RotaAtivaHoje,
  type ParadaRota,
  type DisponibilidadeTecnico,
  type LocalizacaoEstimada,
} from "@/lib/routing/urgencia-impacto";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Tipagem explícita (em vez de `PageProps<"/urgencias/[id]">`) — o helper
// global só existe depois que `next dev`/`next typegen` descobrem a rota
// nova, e o dev server do usuário pode estar rodando; evita depender de
// timing de regeneração de tipos (ver `app/rts/[id]/page.tsx`, que precisou
// disso na sessão em que foi criada).
export default async function UrgenciaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: urgenciaId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  if (role !== "gerente" && role !== "gestao") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva dos perfis gerente e gestão.</p>
      </div>
    );
  }

  const { data: urgencia, error } = await supabase
    .from("urgencias")
    .select(
      "id, codigo, status, chamado_id, motivo, origem, solicitante, anexo_path, prioridade, criado_em, atendida_por_servico_id, opcao_escolhida, equipe_escolhida_id, impacto_km, impacto_min, chamados(id, tomticket_id, assunto, prioridade, status, sla_prazo, criado_em, rt_id, rts(codigo, nome, endereco, bairro, latitude, longitude, caps(nome), regioes(nome, zonas(nome))))",
    )
    .eq("id", urgenciaId)
    .maybeSingle();

  if (error || !urgencia) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">Urgência não encontrada.</p>
      </div>
    );
  }

  const chamado = unwrapOne(urgencia.chamados);
  const rt = chamado ? unwrapOne(chamado.rts) : null;
  if (!chamado || !rt) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">Chamado ou RT vinculados não foram encontrados.</p>
      </div>
    );
  }

  const status = urgencia.status as "solicitada" | "em_analise" | "validada" | "nao_validada" | "em_atendimento" | "cancelada";
  const podeGerenciar = role === "gerente";

  const detalheChamado = await buscarDetalheChamado(chamado.id as string);

  // Status do serviço, quando já existe (em_atendimento) — decide entre
  // técnico escalado / em atendimento / concluída / precisa de novo
  // despacho (ver urgencia-status-badge.tsx).
  let servicoStatus: string | null = null;
  if (urgencia.atendida_por_servico_id) {
    const { data: servico } = await supabase
      .from("servicos")
      .select("status")
      .eq("id", urgencia.atendida_por_servico_id as string)
      .maybeSingle();
    servicoStatus = (servico?.status as string | null) ?? null;
  }
  const statusDisplay = derivarStatusDisplay(status, servicoStatus);

  // "Precisa de novo despacho": o serviço que a decisão anterior criou foi
  // cancelado (reagendamento/pendência/correção) — reusa a MESMA ferramenta
  // que a tela de Pendências já usa pra isso (fn_programar_reexecucao),
  // em vez de inventar um segundo jeito de anexar uma execução nova a uma
  // rota confirmada.
  let rotasReexec: RotaParaReexecucao[] = [];
  let tecnicosReexec: { id: string; nome: string; equipeId: string | null }[] = [];
  if (statusDisplay === "pendente_novo_despacho" && podeGerenciar) {
    const hoje = new Date().toISOString().slice(0, 10);
    const [{ data: rotasRaw }, { data: tecnicosRaw }] = await Promise.all([
      supabase
        .from("rotas")
        .select("id, data, equipe_id, equipes(nome), regioes(nome)")
        .eq("status", "confirmada")
        .gte("data", hoje)
        .order("data", { ascending: true }),
      supabase.from("profiles").select("id, nome, equipe_id").eq("role", "tecnico").eq("ativo", true).order("nome"),
    ]);
    rotasReexec = (rotasRaw ?? []).map((r) => ({
      id: r.id as string,
      data: r.data as string,
      equipeId: r.equipe_id as string,
      equipeNome: unwrapOne(r.equipes)?.nome ?? "—",
      regiaoNome: unwrapOne(r.regioes)?.nome ?? "—",
    }));
    tecnicosReexec = (tecnicosRaw ?? []).map((t) => ({
      id: t.id as string,
      nome: t.nome as string,
      equipeId: (t.equipe_id as string | null) ?? null,
    }));
  }

  // Painel de despacho (só quando validada, aguardando decisão): calculado
  // aqui no servidor — sem round-trip do cliente pra um endpoint próprio,
  // mesmo padrão já usado na Rota Inteligente (evita useEffect disparando
  // fetch+setState à toa). Sem GPS ao vivo do técnico (decisão de
  // 11/09/2026): a posição de referência é a ÚLTIMA/PRÓXIMA parada da rota
  // confirmada de hoje; disponibilidade é carga de trabalho observável
  // agora (servicos em planejado/em_execucao), nunca uma trilha contínua.
  let opcoes: Awaited<ReturnType<typeof calcularImpactoUrgencia>> = [];
  let candidatosMapa: CandidatoMapa[] = [];
  let equipesAtivas: { id: string; nome: string }[] = [];
  let tecnicosAtivos: { id: string; nome: string; equipeId: string | null; ativo: boolean }[] = [];

  if (status === "validada" && podeGerenciar) {
    const hoje = new Date().toISOString().slice(0, 10);

    const [{ data: rotasRaw }, { data: equipesRaw }, { data: tecnicosRaw }] = await Promise.all([
      supabase.from("rotas").select("id, equipe_id, equipes(nome)").eq("data", hoje).eq("status", "confirmada"),
      supabase.from("equipes").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("profiles").select("id, nome, equipe_id, ativo").eq("role", "tecnico").order("nome"),
    ]);

    equipesAtivas = (equipesRaw ?? []).map((e) => ({ id: e.id as string, nome: e.nome as string }));
    tecnicosAtivos = (tecnicosRaw ?? []).map((t) => ({
      id: t.id as string,
      nome: t.nome as string,
      equipeId: (t.equipe_id as string | null) ?? null,
      ativo: t.ativo as boolean,
    }));

    const rotaIds = (rotasRaw ?? []).map((r) => r.id as string);

    if (rotaIds.length > 0) {
      const [{ data: paradasRaw }, { data: servicosRotasRaw }, { data: servicosHojeRaw }, { data: localizacoesRaw }] =
        await Promise.all([
          supabase
            .from("rota_rts")
            .select("rota_id, rt_id, ordem, rts(codigo, latitude, longitude), tecnico_id, tecnico:tecnico_id(nome)")
            .in("rota_id", rotaIds)
            .order("ordem", { ascending: true }),
          supabase.from("servicos").select("rota_id, rt_id, status").in("rota_id", rotaIds),
          // Carga de trabalho de hoje, de TODOS os técnicos (não só os das
          // rotas acima) — é o sinal de "disponibilidade" sem GPS ao vivo.
          supabase.from("servicos").select("tecnico_id, status, rotas!inner(data)").eq("rotas.data", hoje),
          // Localização ESTIMADA (migration 0057, 15/09/2026) — sinal extra,
          // não substitui a matemática de rota. Tabela pequena (1 linha por
          // técnico), sem filtro de data — a idade da leitura vai junto pro
          // gerente julgar se ainda vale confiar nela.
          supabase.from("tecnico_localizacao_estimada").select("tecnico_id, latitude, longitude, atualizado_em"),
        ]);

      // `em_revisao` (0053/0054) conta como "ainda não terminado" nos dois
      // sentidos abaixo, mesmo espírito de `em_execucao` — só a forma de
      // concluir é diferente, não o fato de estar em andamento.
      const paradasPendentes = new Set<string>();
      for (const s of servicosRotasRaw ?? []) {
        if (s.status === "planejado" || s.status === "em_execucao" || s.status === "em_revisao") {
          paradasPendentes.add(`${s.rota_id}-${s.rt_id}`);
        }
      }

      const disponibilidadePorTecnico = new Map<string, DisponibilidadeTecnico>();
      for (const s of servicosHojeRaw ?? []) {
        const tecnicoId = s.tecnico_id as string | null;
        if (!tecnicoId) continue;
        const atual = disponibilidadePorTecnico.get(tecnicoId) ?? { ocupadoAgora: false, restantesHoje: 0 };
        if (s.status === "em_execucao" || s.status === "em_revisao") atual.ocupadoAgora = true;
        if (s.status === "planejado" || s.status === "em_execucao" || s.status === "em_revisao") atual.restantesHoje += 1;
        disponibilidadePorTecnico.set(tecnicoId, atual);
      }

      const rotasPorId = new Map(
        (rotasRaw ?? []).map((r) => [
          r.id as string,
          { equipeId: r.equipe_id as string, equipeNome: unwrapOne(r.equipes)?.nome ?? "—" },
        ]),
      );

      const paradasPorRota = new Map<string, ParadaRota[]>();
      for (const p of paradasRaw ?? []) {
        const rtParada = unwrapOne(p.rts);
        if (!rtParada) continue;
        const chave = p.rota_id as string;
        const lista = paradasPorRota.get(chave) ?? [];
        lista.push({
          rtId: p.rt_id as string,
          codigo: rtParada.codigo as string,
          lat: Number(rtParada.latitude),
          lng: Number(rtParada.longitude),
          ordem: p.ordem as number,
          tecnicoId: (p.tecnico_id as string | null) ?? null,
          tecnicoNome: unwrapOne(p.tecnico)?.nome ?? null,
          feita: !paradasPendentes.has(`${chave}-${p.rt_id}`),
        });
        paradasPorRota.set(chave, lista);
      }

      const localizacaoPorTecnico = new Map<string, LocalizacaoEstimada>();
      for (const l of localizacoesRaw ?? []) {
        localizacaoPorTecnico.set(l.tecnico_id as string, {
          lat: Number(l.latitude),
          lng: Number(l.longitude),
          atualizadoEm: l.atualizado_em as string,
        });
      }

      const rotasAtivas: RotaAtivaHoje[] = rotaIds
        .map((rotaId) => {
          const info = rotasPorId.get(rotaId);
          const paradas = paradasPorRota.get(rotaId) ?? [];
          if (!info || paradas.length === 0) return null;
          return { rotaId, equipeId: info.equipeId, equipeNome: info.equipeNome, paradas };
        })
        .filter((r): r is RotaAtivaHoje => r !== null);

      try {
        opcoes = await calcularImpactoUrgencia(
          { lat: Number(rt.latitude), lng: Number(rt.longitude) },
          rotasAtivas,
          disponibilidadePorTecnico,
          localizacaoPorTecnico,
        );
      } catch {
        opcoes = [];
      }

      const recomendadaRotaId = opcoes[0]?.rotaId ?? null;
      candidatosMapa = rotasAtivas
        .map((rota) => {
          const ordenadas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
          const referencia = ordenadas.find((p) => !p.feita) ?? ordenadas[ordenadas.length - 1];
          if (!referencia) return null;
          return {
            equipeId: rota.equipeId,
            equipeNome: rota.equipeNome,
            lat: referencia.lat,
            lng: referencia.lng,
            recomendada: rota.rotaId === recomendadaRotaId,
          } satisfies CandidatoMapa;
        })
        .filter((c): c is CandidatoMapa => c !== null);
    }
  }

  const chamadoPrioridade = chamado.prioridade as Prioridade;
  const chamadoStatus = chamado.status as StatusChamado;
  const regiaoNome = unwrapOne(rt.regioes)?.nome ?? "—";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <Link href="/urgencias" className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
        ← Central de urgências
      </Link>

      <header className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">{urgencia.codigo}</p>
          <UrgenciaStatusBadge status={statusDisplay} />
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">{chamado.assunto as string}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-text-tertiary">
            TomTicket: <PrioridadeBadge prioridade={chamadoPrioridade} />
          </span>
          <SlaBadge slaPrazo={chamado.sla_prazo as string | null} status={chamadoStatus} />
          <StatusChamadoBadge status={chamadoStatus} />
          {urgencia.prioridade && (
            <span className="flex items-center gap-1 text-text-tertiary">
              Classificação: <PrioridadeBadge prioridade={urgencia.prioridade as Prioridade} />
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <section className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">Chamado</p>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-text-tertiary">RT</dt>
              <dd className="text-text-primary">
                <span className="font-mono text-xs">{rt.codigo}</span> — {rt.nome} ({rt.bairro})
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-tertiary">CAPS</dt>
              <dd className="text-text-primary">{unwrapOne(rt.caps)?.nome ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-tertiary">Região</dt>
              <dd className="text-text-primary">{regiaoNome}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-tertiary">Protocolo TomTicket</dt>
              <dd className="font-mono text-xs text-text-primary">
                {chamado.tomticket_id ? (
                  <a
                    href={tomticketSearchUrl(chamado.tomticket_id as string)}
                    target="_blank"
                    rel="noreferrer"
                    className={`text-accent hover:text-accent-hover ${FOCUS_RING}`}
                  >
                    #{chamado.tomticket_id as string}
                  </a>
                ) : (
                  "— (entrada manual)"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-tertiary">Aberto em</dt>
              <dd className="text-text-primary">{formatoDataHora.format(new Date(chamado.criado_em as string))}</dd>
            </div>
          </dl>

          {detalheChamado.descricao && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-text-tertiary">Mensagem</p>
              <p className="max-h-40 overflow-y-auto rounded-[var(--radius-sm)] border border-border bg-surface-input p-3 text-sm whitespace-pre-wrap text-text-primary">
                {detalheChamado.descricao}
              </p>
            </div>
          )}

          {detalheChamado.anexosCliente.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-text-tertiary">Evidências do cliente</p>
              <div className="flex flex-wrap gap-3 rounded-[var(--radius-sm)] border border-border p-3">
                {detalheChamado.anexosCliente.map((a) =>
                  a.url ? (
                    <LightboxImage
                      key={a.id}
                      url={a.url}
                      alt={a.nome}
                      legenda={a.origem === "abertura" ? "Da abertura" : "De uma resposta"}
                    />
                  ) : (
                    <span key={a.id} className="text-xs text-text-tertiary">
                      {a.nome} (indisponível)
                    </span>
                  ),
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">Urgência</p>
          <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-text-tertiary">Motivo</dt>
              <dd className="text-text-primary">{urgencia.motivo as string}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-tertiary">Origem</dt>
              <dd className="text-text-primary">{URGENCIA_ORIGEM_LABEL[urgencia.origem as UrgenciaOrigem]}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-tertiary">Solicitante</dt>
              <dd className="text-text-primary">{urgencia.solicitante as string}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-tertiary">Registrada em</dt>
              <dd className="text-text-primary">{formatoDataHora.format(new Date(urgencia.criado_em as string))}</dd>
            </div>
          </dl>
        </section>

        {podeGerenciar &&
          (status === "solicitada" ||
            status === "em_analise" ||
            status === "nao_validada" ||
            status === "cancelada") && (
            <UrgenciaAcoes urgenciaId={urgencia.id as string} status={status} prioridadeSugerida={chamadoPrioridade} />
          )}

        {podeGerenciar && status === "validada" && (
          <DecidirAtendimentoPanel
            urgenciaId={urgencia.id as string}
            rt={{
              lat: Number(rt.latitude),
              lng: Number(rt.longitude),
              codigo: rt.codigo as string,
              endereco: rt.endereco as string,
            }}
            opcoes={opcoes}
            candidatosMapa={candidatosMapa}
            equipes={equipesAtivas}
            tecnicos={tecnicosAtivos}
          />
        )}

        {podeGerenciar && statusDisplay === "pendente_novo_despacho" && urgencia.atendida_por_servico_id && (
          <section className="rounded-[var(--radius-md)] border border-sla-vencido/40 bg-sla-vencido/5 p-4">
            <p className="text-sm font-semibold text-sla-vencido">Precisa de um novo despacho</p>
            <p className="mt-1 text-xs text-text-secondary">
              O atendimento anterior não foi concluído (reagendamento, correção ou pendência do técnico). Programe
              uma nova execução pra essa RT numa rota confirmada.
            </p>
            <div className="mt-3">
              <ProgramarReexecucao
                servicoId={urgencia.atendida_por_servico_id as string}
                rtCodigo={rt.codigo as string}
                chamadoAssunto={chamado.assunto as string}
                rotas={rotasReexec}
                tecnicos={tecnicosReexec}
              />
            </div>
          </section>
        )}

        {detalheChamado.historico.length > 0 && (
          <section className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <HistoricoChamado eventos={detalheChamado.historico} />
          </section>
        )}
      </div>
    </div>
  );
}
