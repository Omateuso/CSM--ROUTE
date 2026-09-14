import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { StatusServicoBadge, type StatusServico } from "../../status-servico-badge";
import { IniciarServicoForm } from "./iniciar-servico-form";
import { ConcluirServicoForm } from "./concluir-servico-form";
import { PendenciaForm } from "./pendencia-form";
import { AvaliarServicoForm } from "./avaliar-servico-form";
import { FOCUS_RING } from "@/lib/ui/styles";
import { linkGoogleMapsDestino, linkWaze } from "@/lib/navegacao";
import { HistoricoChamado, type HistoricoEvento } from "@/lib/ui/historico-chamado";
import { PENDENCIA_CATEGORIA_LABEL, type PendenciaCategoria } from "@/lib/ui/pendencia-categoria";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function unwrapMany<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

const MOMENTO_LABEL: Record<string, string> = { antes: "Foto antes", parcial: "Foto parcial", depois: "Foto depois" };

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Com ano: sem ele, um chamado de 2025 e um de 2026 aparecem como "08/09" e
// "12/11" e o técnico lê fora de ordem, sem ter como perceber (achado do
// usuário, 08/09/2026).
const formatoDataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

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
      "id, status, categoria, concluido_em, tecnico_id, chamado_id, chamados(assunto, descricao, prioridade, sla_prazo, status, tomticket_id, criado_em), rts(codigo, nome, endereco, latitude, longitude)",
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
    .select("id, evento, descricao, categoria, servico_id, criado_em, criado_por:criado_por(nome)")
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

  // Evidências do cliente (Fase 3, 0036) — fotos que o cliente anexou no
  // TomTicket (na abertura ou numa resposta). O técnico vê antes de ir.
  const { data: anexosClienteRaw } = await supabase
    .from("chamado_anexos_cliente")
    .select("id, nome, origem, storage_path")
    .eq("chamado_id", servicoRaw.chamado_id as string)
    .order("criado_em", { ascending: true });

  const anexosCliente: { id: string; nome: string; origem: string; url: string | null }[] = [];
  if ((anexosClienteRaw ?? []).length > 0) {
    const { data: assinadas } = await supabase.storage
      .from("respostas-cliente")
      .createSignedUrls((anexosClienteRaw ?? []).map((a) => a.storage_path as string), 3600);
    const urlPor = new Map((assinadas ?? []).map((i) => [i.path ?? "", i.signedUrl]));
    for (const a of anexosClienteRaw ?? []) {
      anexosCliente.push({
        id: a.id as string,
        nome: a.nome as string,
        origem: a.origem as string,
        url: urlPor.get(a.storage_path as string) ?? null,
      });
    }
  }

  // Tentativa anterior: se este chamado já teve um serviço CANCELADO (pendência
  // ou reagendamento), o técnico precisa do contexto do que já foi feito — sem
  // ter que reconstruir tudo. Herda do serviço anterior, não pede de novo
  // (princípio de UX da evolução operacional).
  const { data: anteriorRaw } = await supabase
    .from("servicos")
    .select("id, criado_em, tecnico:tecnico_id(nome), evidencias(tipo, momento, storage_path)")
    .eq("chamado_id", servicoRaw.chamado_id as string)
    .eq("status", "cancelado")
    .neq("id", servicoRaw.id as string)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const anteriorEvidencias = anteriorRaw ? unwrapMany(anteriorRaw.evidencias) : [];
  const urlPorCaminhoAnterior = new Map<string, string>();
  if (anteriorEvidencias.length > 0) {
    const { data: assinadas } = await supabase.storage
      .from("evidencias")
      .createSignedUrls(anteriorEvidencias.map((e) => e.storage_path as string), 3600);
    for (const item of assinadas ?? []) {
      if (item.signedUrl) urlPorCaminhoAnterior.set(item.path ?? "", item.signedUrl);
    }
  }

  // Fase 4 (seção 7): o técnico já apontou um problema neste serviço? A
  // trava real é no fn_avaliar_servico; aqui é só pra a UI mostrar "já
  // enviado" em vez de oferecer o formulário de novo.
  const apontamentoDesteServico = (historicoRaw ?? []).find(
    (h) => h.evento === "servico_avaliado" && (h.servico_id as string | null) === (servicoRaw.id as string),
  );

  const motivoAnterior = [...historico]
    .reverse()
    .find((e) => e.evento === "servico_pendente" || e.evento === "servico_reagendado");

  const tentativaAnterior = anteriorRaw
    ? {
        tecnicoNome: unwrapOne(anteriorRaw.tecnico)?.nome ?? "outro técnico",
        criadoEm: anteriorRaw.criado_em as string,
        motivoRotulo: motivoAnterior?.categoria
          ? (PENDENCIA_CATEGORIA_LABEL[motivoAnterior.categoria as PendenciaCategoria] ??
            motivoAnterior.categoria)
          : motivoAnterior?.evento === "servico_reagendado"
            ? "Reagendado"
            : "Motivo",
        motivoTexto: motivoAnterior?.descricao ?? null,
        anexos: anteriorEvidencias
          .map((e) => ({
            rotulo:
              e.tipo === "os"
                ? "OS"
                : (MOMENTO_LABEL[(e.momento as string | null) ?? ""] ?? "Foto"),
            url: urlPorCaminhoAnterior.get(e.storage_path as string) ?? null,
          }))
          .filter((a): a is { rotulo: string; url: string } => Boolean(a.url)),
      }
    : null;

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
          {tentativaAnterior && (
            <span className="rounded-full bg-priority-alta/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-priority-alta uppercase">
              ↩ Retorno
            </span>
          )}
          {servicoRaw.categoria === "concluir_hoje" ? (
            <span className="rounded-full bg-sla-dentro/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sla-dentro uppercase">
              Hoje
            </span>
          ) : (
            <span className="rounded-full bg-sla-proximo/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sla-proximo uppercase">
              Para revisão
            </span>
          )}
          <StatusServicoBadge status={status} />
        </div>
        <h1 className="mt-1 text-lg font-semibold text-text-primary">{rt?.nome}</h1>
        <p className="mt-0.5 text-sm text-text-tertiary">{rt?.endereco}</p>

        {/* Navegação abre no app de mapa do próprio técnico — turn-by-turn de
            verdade, sem custo de API e sem reimplementar navegação no PWA. */}
        {rt?.latitude != null && rt?.longitude != null && (
          <div className="mt-3 flex gap-2">
            <a
              href={linkGoogleMapsDestino({ lat: Number(rt.latitude), lng: Number(rt.longitude) })}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-accent bg-accent/5 px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 ${FOCUS_RING}`}
            >
              <span aria-hidden="true">➤</span>
              Como chegar
            </a>
            <a
              href={linkWaze({ lat: Number(rt.latitude), lng: Number(rt.longitude) })}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir no Waze"
              className={`flex shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border px-3 py-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-input ${FOCUS_RING}`}
            >
              Waze
            </a>
          </div>
        )}
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
          {servicoRaw.categoria === "revisao_tecnica" && (
            <p className="mt-3 text-xs text-sla-proximo">
              Marcado pelo gerente como revisão — dê uma passada e registre o que encontrar, sem a
              mesma cobrança de fechar hoje que os chamados do dia têm.
            </p>
          )}
        </section>

        {anexosCliente.length > 0 && (
          <section className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <p className="text-xs font-semibold tracking-wide text-text-tertiary uppercase">
              Evidências do cliente
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {anexosCliente.map((a) =>
                a.url ? (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex flex-col items-start gap-1 ${FOCUS_RING}`}
                  >
                    <span className="text-[11px] text-text-tertiary">
                      {a.origem === "abertura" ? "Da abertura" : "De uma resposta"}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do bucket privado */}
                    <img
                      src={a.url}
                      alt={a.nome}
                      className="h-24 w-24 rounded-[var(--radius-sm)] border border-border object-cover transition-opacity hover:opacity-80"
                    />
                  </a>
                ) : (
                  <span key={a.id} className="text-xs text-text-tertiary">
                    {a.nome}
                  </span>
                ),
              )}
            </div>
          </section>
        )}

        {tentativaAnterior && (
          <section className="mt-4 rounded-[var(--radius-md)] border-2 border-priority-alta/40 bg-priority-alta/5 p-4">
            <p className="text-xs font-semibold tracking-wide text-priority-alta uppercase">
              ↩ Tentativa anterior
            </p>
            <p className="mt-1 text-sm text-text-primary">
              {tentativaAnterior.tecnicoNome} ·{" "}
              {formatoDataCurta.format(new Date(tentativaAnterior.criadoEm))}
            </p>
            {tentativaAnterior.motivoTexto && (
              <p className="mt-1 text-sm text-text-secondary">
                <span className="font-medium text-text-primary">{tentativaAnterior.motivoRotulo}:</span>{" "}
                {tentativaAnterior.motivoTexto}
              </p>
            )}
            {tentativaAnterior.anexos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {tentativaAnterior.anexos.map((a) => (
                  <a
                    key={a.url}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex flex-col items-start gap-1 ${FOCUS_RING}`}
                  >
                    <span className="text-xs font-medium text-text-secondary">{a.rotulo}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage */}
                    <img
                      src={a.url}
                      alt={a.rotulo}
                      className="h-24 w-24 rounded-[var(--radius-sm)] border border-border object-cover transition-opacity hover:opacity-80"
                    />
                  </a>
                ))}
              </div>
            )}
          </section>
        )}

        {historico.length > 0 && (
          <section className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface p-4">
            <HistoricoChamado eventos={historico} />
          </section>
        )}

        <div className="mt-5">
          {status === "planejado" && (
            <div className="flex flex-col gap-4">
              <IniciarServicoForm servicoId={servicoRaw.id as string} />

              {apontamentoDesteServico ? (
                <p className="rounded-[var(--radius-md)] border border-border bg-surface-input p-3 text-xs text-text-secondary">
                  ⚠ Você apontou um problema neste serviço em{" "}
                  {formatoDataCurta.format(new Date(apontamentoDesteServico.criado_em as string))} — o
                  gerente foi avisado.
                </p>
              ) : (
                <details className="group rounded-[var(--radius-md)] border border-border p-3">
                  <summary
                    className={`flex cursor-pointer items-center gap-2 text-xs font-medium text-text-tertiary ${FOCUS_RING}`}
                  >
                    Este serviço tem um problema
                    <span className="ml-auto font-normal group-open:hidden">toque pra abrir</span>
                  </summary>
                  <div className="mt-3">
                    <AvaliarServicoForm servicoId={servicoRaw.id as string} />
                  </div>
                </details>
              )}
            </div>
          )}

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
