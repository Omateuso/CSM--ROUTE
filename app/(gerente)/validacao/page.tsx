import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ValidacaoCard, type ServicoConcluidoRow } from "./validacao-card";
import { ReagendamentoCard, type ServicoTravadoRow } from "./reagendamento-card";
import { ValidadosRecentes, type ValidadoRow } from "./validados-recentes";
import { PendenciasLinkButton } from "./pendencias-link-button";
import { OperacaoHojeCard } from "@/lib/ui/operacao-hoje-card";
import { type HistoricoEvento } from "@/lib/ui/historico-chamado";
import { detectarHashesDuplicados, avaliarIntegridadeOs, type OsIntegridadeInfo } from "./integridade";
import { mensagemConclusao } from "@/lib/tomticket/mensagens";
import { tomticketConfigurado } from "@/lib/tomticket/config";

// Mesma situação das demais telas: sem Database types gerados ainda, embed
// aninhado fica ambíguo pro TypeScript (array vs objeto único), embora em
// runtime "to-one" (chamados, rts, tecnico) sempre venha objeto único e
// "to-many" (conclusoes, evidencias) sempre venha array.
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function unwrapMany<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

export default async function ValidacaoPage() {
  const supabase = await createClient();

  // Sessão do cookie, sem ida à rede — o proxy.ts (middleware) já fez o
  // getUser() autoritativo + refresh do token nesta requisição e redireciona
  // quem não está logado. Aqui só precisa do id pra buscar a role; RLS é o
  // backstop por linha.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
  if (profile?.role !== "gerente") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva do perfil gerente.</p>
      </div>
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);

  const [
    { data: concluidosRaw, error: concluidosError },
    { data: travadosRaw, error: travadosError },
    { data: validadosRaw, error: validadosError },
  ] = await Promise.all([
    supabase
      .from("servicos")
      .select(
        "id, chamado_id, concluido_em, tecnico:tecnico_id(nome), chamados(assunto, descricao, prioridade, sla_prazo, status, tomticket_id), rts(codigo, nome, endereco, latitude, longitude), conclusoes(observacao), evidencias(tipo, momento, storage_path, latitude, longitude, hash_arquivo)",
      )
      .eq("status", "concluido_tecnico")
      .order("concluido_em", { ascending: true }),
    supabase
      .from("servicos")
      .select(
        "id, chamado_id, status, tecnico:tecnico_id(nome), chamados(assunto, prioridade, sla_prazo, status, tomticket_id), rts(codigo, nome), rotas(data)",
      )
      .in("status", ["planejado", "em_execucao"]),
    supabase
      .from("validacoes")
      .select(
        "id, validado_em, servicos(id, chamado_id, concluido_em, tomticket_resposta_id, tecnico:tecnico_id(nome), chamados(assunto, descricao, prioridade, sla_prazo, status, tomticket_id), rts(codigo, nome, endereco, latitude, longitude), conclusoes(observacao), evidencias(tipo, momento, storage_path, latitude, longitude, hash_arquivo))",
      )
      .order("validado_em", { ascending: false })
      .limit(20),
  ]);

  if (concluidosError || travadosError || validadosError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados (
          {concluidosError?.message ?? travadosError?.message ?? validadosError?.message}).
        </p>
      </div>
    );
  }

  // Versão mínima da Parte E adiantada (ver lib/ui/historico-chamado.tsx) —
  // o gerente decidindo validar ou reagendar de novo precisa ver se aquele
  // chamado já teve uma tentativa reagendada antes, não só o estado atual.
  const todosChamadoIds = [
    ...new Set(
      [
        ...(concluidosRaw ?? []).map((s) => s.chamado_id as string),
        ...(travadosRaw ?? []).map((s) => s.chamado_id as string),
        ...(validadosRaw ?? []).map((v) => unwrapOne(v.servicos)?.chamado_id as string).filter(Boolean),
      ],
    ),
  ];
  const historicoPorChamado = new Map<string, HistoricoEvento[]>();
  const respondidoEmPorServico = new Map<string, string>();
  if (todosChamadoIds.length > 0) {
    const { data: historicoRaw } = await supabase
      .from("historico")
      .select(
        "id, chamado_id, servico_id, evento, descricao, categoria, criado_em, criado_por:criado_por(nome)",
      )
      .in("chamado_id", todosChamadoIds)
      .order("criado_em", { ascending: true });

    for (const h of historicoRaw ?? []) {
      // Quando o serviço foi respondido no TomTicket. O recibo em
      // `servicos.tomticket_resposta_id` diz QUE foi, o histórico diz QUANDO —
      // um chamado pode ter mais de um serviço respondido ao longo do tempo,
      // por isso a chave é o serviço, não o chamado.
      if (h.evento === "tomticket_respondido" && h.servico_id) {
        respondidoEmPorServico.set(h.servico_id as string, h.criado_em as string);
      }

      const chave = h.chamado_id as string;
      const lista = historicoPorChamado.get(chave) ?? [];
      lista.push({
        id: h.id as string,
        evento: h.evento as string,
        descricao: h.descricao as string | null,
        categoria: (h.categoria as string | null) ?? null,
        criadoEm: h.criado_em as string,
        criadoPorNome: unwrapOne(h.criado_por)?.nome ?? null,
      });
      historicoPorChamado.set(chave, lista);
    }
  }

  // Pacote 2 (auditoria de segurança, 21/08/2026): detecta OS reaproveitada
  // entre serviços diferentes — traz o hash de TODA OS do projeto (não só
  // os serviços desta página), agrupa em JS, e resolve uma referência
  // (código da RT + data da rota) só pros serviços "outros" que de fato
  // compartilham hash com algo aqui na tela.
  // .order("criado_em") é essencial aqui — detectarHashesDuplicados assume
  // que o primeiro servicoId de cada grupo é quem anexou aquele arquivo
  // primeiro (ver comentário em integridade.ts).
  const { data: osHashesRaw } = await supabase
    .from("evidencias")
    .select("servico_id, hash_arquivo, criado_em")
    .eq("tipo", "os")
    .not("hash_arquivo", "is", null)
    .order("criado_em", { ascending: true });

  const hashesDuplicados = detectarHashesDuplicados(
    (osHashesRaw ?? []).map((r) => ({
      servicoId: r.servico_id as string,
      hashArquivo: r.hash_arquivo as string,
      criadoEm: r.criado_em as string,
    })),
  );

  const servicoIdsParaResolver = new Set<string>();
  for (const ids of hashesDuplicados.values()) {
    ids.forEach((id) => servicoIdsParaResolver.add(id));
  }

  const refPorServicoId = new Map<string, OsIntegridadeInfo["ref"]>();
  if (servicoIdsParaResolver.size > 0) {
    const { data: refsRaw } = await supabase
      .from("servicos")
      .select("id, rts(codigo), rotas(data)")
      .in("id", [...servicoIdsParaResolver]);
    for (const s of refsRaw ?? []) {
      const rt = unwrapOne(s.rts);
      const rota = unwrapOne(s.rotas);
      refPorServicoId.set(s.id as string, {
        rtCodigo: rt?.codigo ?? "—",
        rotaData: (rota?.data as string | null) ?? null,
      });
    }
  }

  // Junta os caminhos de todas as evidências pra gerar as URLs assinadas
  // numa única chamada (bucket privado — createSignedUrl(s), não getPublicUrl).
  const todosCaminhos = [
    ...(concluidosRaw ?? []).flatMap((s) => unwrapMany(s.evidencias).map((e) => e.storage_path as string)),
    ...(validadosRaw ?? []).flatMap((v) =>
      unwrapMany(unwrapOne(v.servicos)?.evidencias).map((e) => e.storage_path as string),
    ),
  ];
  const urlPorCaminho = new Map<string, string>();
  if (todosCaminhos.length > 0) {
    const { data: assinadas } = await supabase.storage.from("evidencias").createSignedUrls(todosCaminhos, 3600);
    for (const item of assinadas ?? []) {
      if (item.signedUrl) urlPorCaminho.set(item.path ?? "", item.signedUrl);
    }
  }

  const concluidos: ServicoConcluidoRow[] = (concluidosRaw ?? []).map((s) => {
    const chamado = unwrapOne(s.chamados);
    const rt = unwrapOne(s.rts);
    const evidencias = unwrapMany(s.evidencias).map((e) => ({
      tipo: e.tipo as "foto" | "os" | "documento",
      momento: (e.momento as "antes" | "depois" | null) ?? null,
      latitude: (e.latitude as number | null) ?? null,
      longitude: (e.longitude as number | null) ?? null,
      hashArquivo: (e.hash_arquivo as string | null) ?? null,
      url: urlPorCaminho.get(e.storage_path as string) ?? null,
    }));
    return {
      servicoId: s.id as string,
      concluidoEm: s.concluido_em as string | null,
      tecnicoNome: unwrapOne(s.tecnico)?.nome ?? "—",
      rtCodigo: rt?.codigo ?? "—",
      rtNome: rt?.nome ?? "—",
      rtEndereco: rt?.endereco ?? "—",
      rtLatitude: (rt?.latitude as number | null) ?? null,
      rtLongitude: (rt?.longitude as number | null) ?? null,
      chamadoAssunto: chamado?.assunto ?? "—",
      chamadoDescricao: (chamado?.descricao as string | null) ?? null,
      prioridade: chamado?.prioridade ?? "normal",
      slaPrazo: (chamado?.sla_prazo as string | null) ?? null,
      chamadoStatus: chamado?.status ?? "aberto",
      tomticketId: (chamado?.tomticket_id as string | null) ?? null,
      observacao: unwrapOne(s.conclusoes)?.observacao ?? null,
      evidencias,
      osIntegridade: avaliarIntegridadeOs(s.id as string, evidencias, hashesDuplicados, refPorServicoId),
      historico: historicoPorChamado.get(s.chamado_id as string) ?? [],
    };
  });

  // "Travado" = serviço ainda não concluído (planejado/em_execucao) numa
  // rota cuja data já passou — hoje ainda está em andamento normal, não é
  // sinal de nada parado. Painel do gerente (Parte B) vai ter uma visão de
  // gargalos mais completa; isso aqui é só o suficiente pra reagendar.
  const travados: ServicoTravadoRow[] = (travadosRaw ?? [])
    .filter((s) => {
      const rota = unwrapOne(s.rotas);
      return rota?.data && (rota.data as string) < hoje;
    })
    .map((s) => {
      const chamado = unwrapOne(s.chamados);
      const rt = unwrapOne(s.rts);
      const rota = unwrapOne(s.rotas);
      return {
        servicoId: s.id as string,
        status: s.status as "planejado" | "em_execucao",
        rotaData: rota?.data as string,
        tecnicoNome: unwrapOne(s.tecnico)?.nome ?? "—",
        rtCodigo: rt?.codigo ?? "—",
        rtNome: rt?.nome ?? "—",
        chamadoAssunto: chamado?.assunto ?? "—",
        prioridade: chamado?.prioridade ?? "normal",
        slaPrazo: (chamado?.sla_prazo as string | null) ?? null,
        chamadoStatus: chamado?.status ?? "aberto",
        tomticketId: (chamado?.tomticket_id as string | null) ?? null,
        historico: historicoPorChamado.get(s.chamado_id as string) ?? [],
      };
    });

  const validados: ValidadoRow[] = (validadosRaw ?? []).map((v) => {
    const servico = unwrapOne(v.servicos);
    const chamado = servico ? unwrapOne(servico.chamados) : null;
    const rt = servico ? unwrapOne(servico.rts) : null;
    const evidencias = servico
      ? unwrapMany(servico.evidencias).map((e) => ({
          tipo: e.tipo as "foto" | "os" | "documento",
          momento: (e.momento as "antes" | "depois" | null) ?? null,
          latitude: (e.latitude as number | null) ?? null,
          longitude: (e.longitude as number | null) ?? null,
          hashArquivo: (e.hash_arquivo as string | null) ?? null,
          url: urlPorCaminho.get(e.storage_path as string) ?? null,
        }))
      : [];
    return {
      validacaoId: v.id as string,
      servicoId: (servico?.id as string | undefined) ?? "",
      // Recibo do envio ao TomTicket (migration 0028) — preenchido vira estado
      // "Respondido", some o botão.
      tomticketRespostaId: (servico?.tomticket_resposta_id as string | null) ?? null,
      respondidoEm: servico ? (respondidoEmPorServico.get(servico.id as string) ?? null) : null,
      validadoEm: v.validado_em as string,
      concluidoEm: (servico?.concluido_em as string | null) ?? null,
      tecnicoNome: servico ? (unwrapOne(servico.tecnico)?.nome ?? "—") : "—",
      rtCodigo: rt?.codigo ?? "—",
      rtNome: rt?.nome ?? "—",
      rtEndereco: rt?.endereco ?? "—",
      rtLatitude: (rt?.latitude as number | null) ?? null,
      rtLongitude: (rt?.longitude as number | null) ?? null,
      chamadoAssunto: chamado?.assunto ?? "—",
      chamadoDescricao: (chamado?.descricao as string | null) ?? null,
      prioridade: chamado?.prioridade ?? "normal",
      slaPrazo: (chamado?.sla_prazo as string | null) ?? null,
      chamadoStatus: chamado?.status ?? "aberto",
      tomticketId: (chamado?.tomticket_id as string | null) ?? null,
      observacao: servico ? (unwrapOne(servico.conclusoes)?.observacao ?? null) : null,
      evidencias,
      osIntegridade: servico
        ? avaliarIntegridadeOs(servico.id as string, evidencias, hashesDuplicados, refPorServicoId)
        : null,
      historico: historicoPorChamado.get(servico?.chamado_id as string) ?? [],
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Execução</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary uppercase">Validação</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Confira o que o técnico concluiu e feche o ciclo, ou reagende o que ficou parado numa rota
            que já passou.
          </p>
        </div>
        <PendenciasLinkButton />
      </header>

      {/* Resumo clicável (25/08/2026) — mesmo layout dos cards de "Operação
          de hoje" do Dashboard, mas cada um navega (âncora) pra listagem
          correspondente logo abaixo, na ordem em que elas aparecem na página. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <OperacaoHojeCard label="Validados recentemente" value={validados.length} href="#validados-recentemente" />
        <OperacaoHojeCard label="Aguardando validação" value={concluidos.length} href="#aguardando-validacao" />
        <OperacaoHojeCard label="Travados em rota já passada" value={travados.length} href="#travados" />
      </div>

      <ValidadosRecentes
        validados={validados}
        id="validados-recentemente"
        // Texto montado no servidor: a saudação depende da hora, e gerar dos
        // dois lados abriria descasamento de hidratação.
        mensagemPadrao={mensagemConclusao()}
        integracaoAtiva={tomticketConfigurado()}
      />

      <section id="aguardando-validacao" className="mt-10 scroll-mt-24">
        <h2 className="text-sm font-semibold text-text-primary">
          Aguardando validação <span className="font-normal text-text-tertiary">({concluidos.length})</span>
        </h2>
        {concluidos.length === 0 ? (
          <p className="mt-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-8 text-center text-sm text-text-tertiary">
            Nenhum serviço concluído aguardando validação.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {concluidos.map((s) => (
              <ValidacaoCard key={s.servicoId} servico={s} />
            ))}
          </div>
        )}
      </section>

      <section id="travados" className="mt-10 scroll-mt-24">
        <h2 className="text-sm font-semibold text-text-primary">
          Travados em rota já passada <span className="font-normal text-text-tertiary">({travados.length})</span>
        </h2>
        {travados.length === 0 ? (
          <p className="mt-3 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-8 text-center text-sm text-text-tertiary">
            Nenhum serviço travado.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {travados.map((s) => (
              <ReagendamentoCard key={s.servicoId} servico={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
