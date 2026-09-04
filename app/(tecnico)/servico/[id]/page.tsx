import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { StatusServicoBadge, type StatusServico } from "../../status-servico-badge";
import { IniciarServicoForm } from "./iniciar-servico-form";
import { ConcluirServicoForm } from "./concluir-servico-form";
import { PendenciaForm } from "./pendencia-form";
import { FOCUS_RING } from "@/lib/ui/styles";
import { HistoricoChamado, type HistoricoEvento } from "@/lib/ui/historico-chamado";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const formatoDataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export default async function ServicoPage({ params }: PageProps<"/servico/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "tecnico") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva do perfil técnico.</p>
      </div>
    );
  }

  // RLS (servicos_select) já garante que só volta linha se for do próprio
  // técnico ou de gerente/gestão — aqui o filtro por tecnico_id é só pra
  // não mostrar o serviço de outro técnico pra este técnico.
  const { data: servicoRaw } = await supabase
    .from("servicos")
    .select(
      "id, status, concluido_em, tecnico_id, chamado_id, chamados(assunto, descricao, prioridade, sla_prazo, status, tomticket_id, criado_em), rts(codigo, nome, endereco)",
    )
    .eq("id", id)
    .eq("tecnico_id", user.id)
    .maybeSingle();

  if (!servicoRaw) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-text-secondary">Serviço não encontrado.</p>
        <Link href="/servicos-do-dia" className={`text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
          Voltar pros meus serviços →
        </Link>
      </div>
    );
  }

  // Versão mínima da Parte E adiantada (ver lib/ui/historico-chamado.tsx) —
  // pega a linha do tempo do chamado, incluindo tentativas anteriores
  // reagendadas, que o técnico não teria como saber olhando só o serviço
  // atual (cada reagendamento cria um `servico` novo, sem ligação visível
  // ao anterior fora do `historico`).
  const { data: historicoRaw } = await supabase
    .from("historico")
    .select("id, evento, descricao, categoria, criado_em, criado_por:criado_por(nome)")
    .eq("chamado_id", servicoRaw.chamado_id as string)
    .order("criado_em", { ascending: true });

  const historico: HistoricoEvento[] = (historicoRaw ?? []).map((h) => ({
    id: h.id as string,
    evento: h.evento as string,
    descricao: h.descricao as string | null,
    categoria: (h.categoria as string | null) ?? null,
    criadoEm: h.criado_em as string,
    criadoPorNome: unwrapOne(h.criado_por)?.nome ?? null,
  }));

  const chamado = unwrapOne(servicoRaw.chamados);
  const rt = unwrapOne(servicoRaw.rts);
  const status = servicoRaw.status as StatusServico;
  const slaPrazo = (chamado?.sla_prazo as string | null) ?? null;
  const chamadoStatus = chamado?.status as "aberto" | "em_andamento" | "finalizado" | "cancelado";

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border px-4 pt-6 pb-4">
        <Link
          href="/servicos-do-dia"
          className={`text-xs font-medium text-text-tertiary hover:text-text-primary ${FOCUS_RING}`}
        >
          ← Meus serviços
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-mono text-xs text-text-secondary">{rt?.codigo}</span>
          {chamado?.tomticket_id && (
            <span className="font-mono text-xs text-text-tertiary">#{chamado.tomticket_id}</span>
          )}
          {chamado?.criado_em && (
            <span className="text-xs text-text-tertiary">
              criado em {formatoDataCurta.format(new Date(chamado.criado_em as string))}
            </span>
          )}
          <StatusServicoBadge status={status} />
        </div>
        <h1 className="mt-1 text-lg font-semibold text-text-primary">{rt?.nome}</h1>
        <p className="mt-0.5 text-sm text-text-tertiary">{rt?.endereco}</p>
      </header>

      <div className="flex-1 px-4 py-5">
        <section className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            <PrioridadeBadge prioridade={chamado?.prioridade as Prioridade} />
            <SlaBadge slaPrazo={slaPrazo} status={chamadoStatus} />
          </div>
          <p className="mt-3 text-sm font-medium text-text-primary">{chamado?.assunto}</p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-text-secondary">
            {chamado?.descricao || "Sem descrição registrada."}
          </p>
          {slaPrazo && (
            <p className="mt-3 text-xs text-text-tertiary">Prazo: {formatoDataHora.format(new Date(slaPrazo))}</p>
          )}
        </section>

        {historico.length > 0 && (
          <section className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <HistoricoChamado eventos={historico} />
          </section>
        )}

        <div className="mt-5">
          {status === "planejado" && <IniciarServicoForm servicoId={servicoRaw.id as string} />}

          {status === "em_execucao" && (
            <div className="flex flex-col gap-4">
              <ConcluirServicoForm servicoId={servicoRaw.id as string} />
              <details className="group rounded-[var(--radius-md)] border-2 border-priority-alta/40 bg-priority-alta/5 p-4">
                <summary
                  className={`flex cursor-pointer items-center gap-2 text-sm font-semibold text-priority-alta ${FOCUS_RING}`}
                >
                  <span aria-hidden="true">⚠️</span>
                  Não consegui concluir o atendimento
                  <span className="ml-auto text-xs font-normal text-priority-alta/80 group-open:hidden">
                    toque pra abrir
                  </span>
                </summary>
                <div className="mt-4">
                  <PendenciaForm servicoId={servicoRaw.id as string} />
                </div>
              </details>
            </div>
          )}

          {(status === "concluido_tecnico" || status === "aguardando_validacao" || status === "validado") && (
            <p className="rounded-[var(--radius-md)] border border-sla-dentro/30 bg-sla-dentro/5 p-4 text-sm text-text-primary">
              ✓ Concluído
              {servicoRaw.concluido_em
                ? ` em ${formatoDataHora.format(new Date(servicoRaw.concluido_em as string))}`
                : ""}{" "}
              — aguardando validação do gerente.
            </p>
          )}

          {status === "cancelado" && (
            <p className="rounded-[var(--radius-md)] border border-border bg-surface-input p-4 text-sm text-text-secondary">
              Atendimento cancelado — o chamado voltou a ficar disponível pra uma próxima rota.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
