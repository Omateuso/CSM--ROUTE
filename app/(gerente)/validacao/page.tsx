import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ValidacaoCard, type ServicoConcluidoRow } from "./validacao-card";
import { ReagendamentoCard, type ServicoTravadoRow } from "./reagendamento-card";
import { ApontamentoCard, type ApontamentoRow } from "./apontamento-card";
import { ValidadosRecentes, type ValidadoRow } from "./validados-recentes";
import { PendenciasLinkButton } from "./pendencias-link-button";
import { OperacaoHojeCard } from "@/lib/ui/operacao-hoje-card";
import { type HistoricoEvento } from "@/lib/ui/historico-chamado";
import { detectarHashesDuplicados, avaliarIntegridadeOs, type OsIntegridadeInfo } from "./integridade";
import { saudacao } from "@/lib/tomticket/mensagens";
import { tomticketConfigurado } from "@/lib/tomticket/config";
import { ValidacaoRealtime } from "./validacao-realtime";

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
    { data: apontamentosRaw, error: apontamentosError },
  ] = await Promise.all([
    supabase
      .from("servicos")
      .select(
        "id, chamado_id, categoria, concluido_em, tecnico:tecnico_id(nome), chamados(assunto, descricao, prioridade, sla_prazo, status, tomticket_id), rts(codigo, nome, endereco, latitude, longitude), conclusoes(observacao), evidencias(tipo, momento, storage_path, latitude, longitude, hash_arquivo)",
      )
      .eq("status", "concluido_tecnico")
      .order("concluido_em", { ascending: true }),
    supabase
      .from("servicos")
      .select(
        "id, chamado_id, status, tecnico:tecnico_id(nome), chamados(assunto, prioridade, sla_prazo, status, tomticket_id), rts(codigo, nome), rotas(data)",
      )
      .in("status", ["planejado", "em_execucao", "em_revisao"]),
    supabase
      .from("validacoes")
      .select(
        "id, validado_em, servicos(id, chamado_id, categoria, concluido_em, tomticket_resposta_id, tecnico:tecnico_id(nome), chamados(assunto, descricao, prioridade, sla_prazo, status, tomticket_id), rts(codigo, nome, endereco, latitude, longitude), conclusoes(observacao), evidencias(tipo, momento, storage_path, latitude, longitude, hash_arquivo))",
      )
      .order("validado_em", { ascending: false })
      .limit(20),
    // Fase 4 (seção 7, 0037) — apontamentos do técnico. O serviço fica
    // `planejado`; o filtro pra "ainda aberto" é feito em JS (serviço saiu
    // de `planejado` = o técnico iniciou ou o gerente reagendou = o
    // apontamento deixou de ser pendência).
    supabase
      .from("historico")
      .select(
        "id, descricao, criado_em, servico_id, servicos(id, status, chamado_id, tecnico:tecnico_id(nome), chamados(assunto, prioridade, sla_prazo, status, tomticket_id), rts(codigo, nome), rotas(data), evidencias(tipo, momento, storage_path))",
      )
      .eq("evento", "servico_avaliado")
      .order("criado_em", { ascending: false }),
  ]);

  if (concluidosError || travadosError || validadosError || apontamentosError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados (
          {concluidosError?.message ??
            travadosError?.message ??
            validadosError?.message ??
            apontamentosError?.message}
          ).
        </p>
      </div>
    );
  }

  // Só os apontamentos "abertos": serviço ainda `planejado`. Um chamado pode
  // ter mais de um serviço avaliado ao longo do tempo — a linha do histórico
  // carrega o `servico_id`, então dá pra casar sem ambiguidade.
  const apontamentosAbertos = (apontamentosRaw ?? []).filter(
    (h) => unwrapOne(h.servicos)?.status === "planejado",
  );

  // Versão mínima da Parte E adiantada (ver lib/ui/historico-chamado.tsx) —
  // o gerente decidindo validar ou reagendar de novo precisa ver se aquele
  // chamado já teve uma tentativa reagendada antes, não só o estado atual.
  const todosChamadoIds = [
    ...new Set(
      [
        ...(concluidosRaw ?? []).map((s) => s.chamado_id as string),
        ...(travadosRaw ?? []).map((s) => s.chamado_id as string),
        ...(validadosRaw ?? []).map((v) => unwrapOne(v.servicos)?.chamado_id as string).filter(Boolean),
        ...apontamentosAbertos.map((h) => unwrapOne(h.servicos)?.chamado_id as string).filter(Boolean),
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
    ...apontamentosAbertos.flatMap((h) =>
      unwrapMany(unwrapOne(h.servicos)?.evidencias)
        .filter((e) => e.momento === "avaliacao")
        .map((e) => e.storage_path as string),
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
      categoria: (s.categoria as "concluir_hoje" | "revisao_tecnica" | null) ?? "concluir_hoje",
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
        status: s.status as "planejado" | "em_execucao" | "em_revisao",
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
      categoria: (servico?.categoria as "concluir_hoje" | "revisao_tecnica" | null) ?? "concluir_hoje",
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

  const apontamentos: ApontamentoRow[] = apontamentosAbertos.map((h) => {
    const servico = unwrapOne(h.servicos);
    const chamado = servico ? unwrapOne(servico.chamados) : null;
    const rt = servico ? unwrapOne(servico.rts) : null;
    const rota = servico ? unwrapOne(servico.rotas) : null;
    const foto = servico
      ? unwrapMany(servico.evidencias).find((e) => e.momento === "avaliacao")
      : null;
    return {
      servicoId: (servico?.id as string | undefined) ?? "",
      apontadoEm: h.criado_em as string,
      descricao: (h.descricao as string | null) ?? "—",
      fotoUrl: foto ? (urlPorCaminho.get(foto.storage_path as string) ?? null) : null,
      tecnicoNome: servico ? (unwrapOne(servico.tecnico)?.nome ?? "—") : "—",
      rtCodigo: rt?.codigo ?? "—",
      rtNome: rt?.nome ?? "—",
      chamadoAssunto: chamado?.assunto ?? "—",
      prioridade: chamado?.prioridade ?? "normal",
      slaPrazo: (chamado?.sla_prazo as string | null) ?? null,
      chamadoStatus: chamado?.status ?? "aberto",
      tomticketId: (chamado?.tomticket_id as string | null) ?? null,
      rotaData: (rota?.data as string | null) ?? null,
      historico: historicoPorChamado.get(servico?.chamado_id as string) ?? [],
    };
  });

  // Sem nada pra decidir (nem aguardando validação, nem apontamento) — o
  // arquivo de "Validados recentemente" é o único conteúdo real da página,
  // então ele sobe pra primeira posição em vez de ficar escondido depois de
  // duas seções vazias (pedido do usuário, 14/09/2026). "Travados" continua
  // depois dele nesse caso — é sobre rota passada, não é o motivo da troca.
  const semPendencias = concluidos.length === 0 && apontamentos.length === 0;

  const secaoAguardando = (
    <section id="aguardando-validacao" className="mt-10 scroll-mt-24">
      <h2 className="text-sm font-semibold text-text-primary">
        Aguardando validação <span className="font-normal text-text-tertiary">({concluidos.length})</span>
      </h2>
      {concluidos.length === 0 ? (
        <p className="mt-3 rounded-[var(--radius-md)] bg-surface shadow-lift px-4 py-8 text-center text-sm text-text-tertiary">
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
  );

  const secaoApontados = (
    <section id="apontados" className="mt-10 scroll-mt-24">
      <h2 className="text-sm font-semibold text-text-primary">
        Apontados pelo técnico <span className="font-normal text-text-tertiary">({apontamentos.length})</span>
      </h2>
      <p className="mt-1 text-xs text-text-tertiary">
        Serviços ainda não iniciados em que o técnico apontou um problema (chamado já resolvido, RT
        errada, escopo diferente...). O serviço segue na rota — reagende pra liberar o chamado, ou
        ignore se o técnico deve seguir mesmo assim.
      </p>
      {apontamentos.length === 0 ? (
        <p className="mt-3 rounded-[var(--radius-md)] bg-surface shadow-lift px-4 py-8 text-center text-sm text-text-tertiary">
          Nenhum apontamento em aberto.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {apontamentos.map((s) => (
            <ApontamentoCard key={s.servicoId} servico={s} />
          ))}
        </div>
      )}
    </section>
  );

  const secaoTravados = (
    <section id="travados" className="mt-10 scroll-mt-24">
      <h2 className="text-sm font-semibold text-text-primary">
        Travados em rota já passada <span className="font-normal text-text-tertiary">({travados.length})</span>
      </h2>
      {travados.length === 0 ? (
        <p className="mt-3 rounded-[var(--radius-md)] bg-surface shadow-lift px-4 py-8 text-center text-sm text-text-tertiary">
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
  );

  // Arquivo do que já foi fechado (Fase 6): não é decisão pendente, é
  // consulta pra copiar/anexar de volta no TomTicket — por isso fica por
  // último quando há algo pendente. Os cards de resumo levam direto aqui de
  // qualquer posição.
  const secaoValidados = (
    <ValidadosRecentes
      validados={validados}
      id="validados-recentemente"
      // Só a saudação vem do servidor (depende da hora — gerar o texto
      // inteiro dos dois lados abriria descasamento de hidratação). O
      // texto em si é montado no client, por card, porque agora depende
      // da categoria do serviço (concluir_hoje -> mensagemConclusao,
      // revisao_tecnica -> mensagemRevisao, migration 0047).
      saudacaoAtual={saudacao()}
      integracaoAtiva={tomticketConfigurado()}
    />
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-text-tertiary">Execução</p>
          <h1 className="mt-1 text-2xl font-semibold text-text-primary">Validação</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Confira o que o técnico concluiu e feche o ciclo, ou reagende o que ficou parado numa rota
            que já passou.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <PendenciasLinkButton />
          <ValidacaoRealtime />
        </div>
      </header>

      {/* Resumo clicável (25/08/2026) — mesmo layout dos cards de "Operação
          de hoje" do Dashboard, cada um é âncora pra seção logo abaixo. A
          ordem dos CARDS não muda (segue a prioridade de ação de sempre) —
          só a ordem das SEÇÕES abaixo se inverte quando não há nada pendente
          (ver `semPendencias`). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OperacaoHojeCard label="Aguardando validação" value={concluidos.length} href="#aguardando-validacao" />
        <OperacaoHojeCard label="Apontados pelo técnico" value={apontamentos.length} href="#apontados" />
        <OperacaoHojeCard label="Travados em rota já passada" value={travados.length} href="#travados" />
        <OperacaoHojeCard label="Validados recentemente" value={validados.length} href="#validados-recentemente" />
      </div>

      {semPendencias ? (
        <>
          {secaoValidados}
          {secaoAguardando}
          {secaoApontados}
          {secaoTravados}
        </>
      ) : (
        <>
          {secaoAguardando}
          {secaoApontados}
          {secaoTravados}
          {secaoValidados}
        </>
      )}
    </div>
  );
}
