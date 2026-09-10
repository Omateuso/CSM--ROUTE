import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tomticketSearchUrl } from "@/lib/tomticket/busca";
import { FOCUS_RING } from "@/lib/ui/styles";
import { EvidenciaThumbs } from "@/lib/ui/evidencia-thumbs";
import { PENDENCIA_CATEGORIA_LABEL, type PendenciaCategoria } from "@/lib/ui/pendencia-categoria";
import { ResponderTomticket } from "../responder-tomticket";
import { ProgramarReexecucao, type RotaParaReexecucao } from "./programar-reexecucao";
import { mensagemPendencia, mensagemReagendamento } from "@/lib/tomticket/mensagens";
import { tomticketConfigurado } from "@/lib/tomticket/config";

// Página própria desde 22/08/2026 (pedido do usuário) — antes era um modal
// dentro de /validacao. Mesma consulta que vivia lá: `historico` com
// evento `servico_pendente` (migration 0026), filtrando os que já foram
// recapturados numa rota nova (resolvem sozinhos).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function unwrapMany<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function PendenciasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gerente") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva do perfil gerente.</p>
      </div>
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);

  const [{ data: pendenciasRaw }, { data: rotasRaw }, { data: tecnicosRaw }] = await Promise.all([
    supabase
      .from("historico")
      .select(
        "id, chamado_id, servico_id, categoria, descricao, criado_em, criado_por:criado_por(nome), chamados(assunto, tomticket_id, status, rts(codigo, nome)), servicos(id, tomticket_resposta_id, evidencias(tipo, momento, storage_path))",
      )
      // Pendência de verdade (técnico não concluiu) OU reagendamento — o
      // usuário pediu que o reagendamento também apareça aqui (10/09/2026),
      // com o mesmo botão de responder o cliente no TomTicket.
      .in("evento", ["servico_pendente", "servico_reagendado"])
      .order("criado_em", { ascending: false }),
    // Rotas confirmadas de hoje em diante — a nova execução é anexada a uma
    // delas (fn_programar_reexecucao não cria rota).
    supabase
      .from("rotas")
      .select("id, data, equipe_id, equipes(nome), regioes(nome)")
      .eq("status", "confirmada")
      .gte("data", hoje)
      .order("data", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, nome, equipe_id")
      .eq("role", "tecnico")
      .eq("ativo", true)
      .order("nome", { ascending: true }),
  ]);

  const rotasReexec: RotaParaReexecucao[] = (rotasRaw ?? []).map((r) => ({
    id: r.id as string,
    data: r.data as string,
    equipeId: r.equipe_id as string,
    equipeNome: unwrapOne(r.equipes)?.nome ?? "—",
    regiaoNome: unwrapOne(r.regioes)?.nome ?? "—",
  }));
  const tecnicosReexec = (tecnicosRaw ?? []).map((t) => ({
    id: t.id as string,
    nome: t.nome as string,
    equipeId: (t.equipe_id as string | null) ?? null,
  }));

  const chamadoIdsPendencia = [...new Set((pendenciasRaw ?? []).map((p) => p.chamado_id as string))];
  const chamadosJaRecapturados = new Set<string>();
  if (chamadoIdsPendencia.length > 0) {
    const { data: servicosAtivosRaw } = await supabase
      .from("servicos")
      .select("chamado_id")
      .in("chamado_id", chamadoIdsPendencia)
      .neq("status", "cancelado");
    for (const s of servicosAtivosRaw ?? []) chamadosJaRecapturados.add(s.chamado_id as string);
  }

  const pendenciasFiltradas = (pendenciasRaw ?? []).filter((p) => {
    if (chamadosJaRecapturados.has(p.chamado_id as string)) return false;
    // Chamado fechado direto no TomTicket não é mais pendência.
    const st = unwrapOne(p.chamados)?.status as string | undefined;
    return st !== "finalizado" && st !== "cancelado";
  });

  const caminhosPendencia = pendenciasFiltradas.flatMap((p) =>
    unwrapMany(unwrapOne(p.servicos)?.evidencias).map((e) => e.storage_path as string),
  );
  const urlPorCaminho = new Map<string, string>();
  if (caminhosPendencia.length > 0) {
    const { data: assinadas } = await supabase.storage.from("evidencias").createSignedUrls(caminhosPendencia, 3600);
    for (const item of assinadas ?? []) {
      if (item.signedUrl) urlPorCaminho.set(item.path ?? "", item.signedUrl);
    }
  }

  // Quando cada serviço foi respondido no TomTicket (migration 0028). O recibo
  // em `servicos.tomticket_resposta_id` diz QUE foi; o histórico diz QUANDO.
  const servicoIdsPendencia = pendenciasFiltradas
    .map((p) => p.servico_id as string | null)
    .filter((id): id is string => Boolean(id));
  const respondidoEmPorServico = new Map<string, string>();
  if (servicoIdsPendencia.length > 0) {
    const { data: respostasRaw } = await supabase
      .from("historico")
      .select("servico_id, criado_em")
      .eq("evento", "tomticket_respondido")
      .in("servico_id", servicoIdsPendencia);
    for (const r of respostasRaw ?? []) {
      respondidoEmPorServico.set(r.servico_id as string, r.criado_em as string);
    }
  }

  const integracaoAtiva = tomticketConfigurado();

  const pendencias = pendenciasFiltradas.map((p) => {
    const chamado = unwrapOne(p.chamados);
    const rt = chamado ? unwrapOne(chamado.rts) : null;
    const servico = unwrapOne(p.servicos);
    const evidenciasServico = unwrapMany(servico?.evidencias);
    const fotoParcial = evidenciasServico.find((e) => e.tipo === "foto" && e.momento === "parcial");
    const os = evidenciasServico.find((e) => e.tipo === "os");
    const categoria = (p.categoria as PendenciaCategoria | null) ?? null;
    const servicoId = (p.servico_id as string | null) ?? null;

    return {
      historicoId: p.id as string,
      servicoId,
      categoria,
      descricao: p.descricao as string | null,
      criadoEm: p.criado_em as string,
      tecnicoNome: unwrapOne(p.criado_por)?.nome ?? "—",
      rtCodigo: rt?.codigo ?? "—",
      rtNome: rt?.nome ?? "—",
      chamadoAssunto: chamado?.assunto ?? "—",
      tomticketId: (chamado?.tomticket_id as string | null) ?? null,
      fotoParcialUrl: fotoParcial ? (urlPorCaminho.get(fotoParcial.storage_path as string) ?? null) : null,
      osUrl: os ? (urlPorCaminho.get(os.storage_path as string) ?? null) : null,
      tomticketRespostaId: (servico?.tomticket_resposta_id as string | null) ?? null,
      respondidoEm: servicoId ? (respondidoEmPorServico.get(servicoId) ?? null) : null,
      // Texto por categoria, não um só: `aguardando_gestao` é um PEDIDO à
      // iGEDES (o chamado fica parado esperando decisão deles), enquanto os
      // outros quatro são "voltaremos". Ver lib/tomticket/mensagens.ts.
      // Montado no servidor por causa da saudação, que depende da hora.
      mensagemPadrao: categoria
        ? mensagemPendencia(categoria, p.descricao as string | null)
        : mensagemReagendamento(p.descricao as string | null),
      anexos: [
        ...(fotoParcial ? ["Foto do parcial"] : []),
        ...(os ? ["OS"] : []),
      ],
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Execução</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary uppercase">Pendências</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Atendimentos que ficaram para trás — o técnico não concluiu, ou o serviço foi reagendado.
          Some sozinha daqui assim que o chamado entrar numa rota nova.
        </p>
      </header>

      {pendencias.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-8 text-center text-sm text-text-tertiary">
          Nenhuma pendência em aberto.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {pendencias.map((p) => (
            <article key={p.historicoId} className="rounded-[var(--radius-md)] border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-text-secondary">{p.rtCodigo}</span>
                    {p.tomticketId && (
                      <span className="font-mono text-xs text-text-tertiary">#{p.tomticketId}</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-text-primary">{p.chamadoAssunto}</p>
                  <p className="text-xs text-text-tertiary">{p.rtNome}</p>
                </div>
                {p.tomticketId && (
                  <a
                    href={tomticketSearchUrl(p.tomticketId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`shrink-0 text-xs font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
                  >
                    Ir para o TomTicket →
                  </a>
                )}
              </div>

              <div className="mt-3 rounded-[var(--radius-sm)] bg-surface-input p-3">
                <p className="text-xs font-semibold text-priority-alta">
                  {p.categoria
                    ? (PENDENCIA_CATEGORIA_LABEL[p.categoria as PendenciaCategoria] ?? p.categoria)
                    : "Reagendado"}
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  {p.categoria ? "Reportado por " : "Reagendado por "}
                  <strong className="text-text-secondary">{p.tecnicoNome}</strong> em{" "}
                  {formatoDataHora.format(new Date(p.criadoEm))}
                </p>
                <p className="mt-1.5 text-sm whitespace-pre-wrap text-text-primary">
                  {p.descricao || "Sem descrição registrada."}
                </p>

                <div className="mt-3">
                  <EvidenciaThumbs
                    itens={[
                      { url: p.fotoParcialUrl, label: "Foto do parcial" },
                      { url: p.osUrl, label: "OS" },
                    ]}
                  />
                </div>
              </div>

              {p.servicoId && (
                <div className="mt-3 flex justify-end">
                  <ProgramarReexecucao
                    servicoId={p.servicoId}
                    rtCodigo={p.rtCodigo}
                    chamadoAssunto={p.chamadoAssunto}
                    rotas={rotasReexec}
                    tecnicos={tecnicosReexec}
                  />
                </div>
              )}

              {/* Responder a pendência no chamado: a equipe esteve lá e não
                  concluiu, e alguma hora isso tem que ser feito — o cliente
                  precisa saber disso e, no caso de `aguardando_gestao`, agir. */}
              {/* `integracaoAtiva` na condição: sem token o botão não renderiza,
                  e sem isto sobraria uma faixa com borda e nada dentro. */}
              {(integracaoAtiva || p.tomticketRespostaId) && p.tomticketId && p.servicoId && p.mensagemPadrao && (
                <div className="mt-3 flex justify-end border-t border-border pt-3">
                  <ResponderTomticket
                    servicoId={p.servicoId}
                    tipo="pendencia"
                    mensagemPadrao={p.mensagemPadrao}
                    anexos={p.anexos}
                    rotuloBotao="Responder pendência no TomTicket"
                    tituloModal="Responder a pendência no TomTicket"
                    respondido={p.tomticketRespostaId !== null}
                    respondidoEm={p.respondidoEm}
                    integracaoAtiva={integracaoAtiva}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
