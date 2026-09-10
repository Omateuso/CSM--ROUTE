import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/app/logout-button";
import { PrioridadeBadge, type Prioridade } from "@/app/chamados/prioridade-badge";
import { SlaBadge } from "@/app/chamados/sla-badge";
import { RtGrupo } from "./rt-grupo";
import { MapaDoDia } from "./mapa-do-dia";
import { StatusServicoBadge, type StatusServico } from "../status-servico-badge";
import { FOCUS_RING } from "@/lib/ui/styles";
import { linkGoogleMapsDestino, linkGoogleMapsRota, paradasNavegaveis } from "@/lib/navegacao";

// Com ano: sem ele, um chamado de 2025 e um de 2026 aparecem como "08/09" e
// "12/11" e o técnico lê fora de ordem, sem ter como perceber (achado do
// usuário, 08/09/2026).
const formatoDataCurta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

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
    // Migration 0025: recusar/pendência de material podem cancelar um
    // serviço de HOJE (diferente de reagendar, que só atuava em rota já
    // passada) — cancelado não tem mais ação nenhuma pro técnico, não
    // precisa aparecer na lista.
    // `validado` é terminal: o gerente já fechou o ciclo, o técnico não tem
    // mais nada a fazer ali. Deixar na lista só empilhava trabalho concluído
    // no meio do que ainda falta. `concluido_tecnico` CONTINUA aparecendo —
    // é a confirmação, pro técnico, de que o envio dele chegou.
    .not("status", "in", "(cancelado,validado)");

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

  const servicos = (servicosRaw ?? [])
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
        chamadoStatus: chamado?.status as "aberto" | "em_andamento" | "finalizado" | "cancelado",
      };
    })
    .sort((a, b) => (a.rotaData === b.rotaData ? a.ordem - b.ordem : a.rotaData.localeCompare(b.rotaData)));

  // Agrupado por dia, na ordem cronológica (pedido do usuário, 08/09/2026).
  const porDia = new Map<string, typeof servicos>();
  for (const s of servicos) {
    const lista = porDia.get(s.rotaData) ?? [];
    lista.push(s);
    porDia.set(s.rotaData, lista);
  }
  // Dentro de cada dia, agrupa por RT — o técnico visita CASAS, não chamados
  // soltos. Uma rota com 8 chamados na mesma RT virava 8 cards repetindo o
  // mesmo código e endereço (pedido do usuário, 08/09/2026).
  const dias = [...porDia.entries()].map(([dia, doDia]) => {
    const porRt = new Map<string, typeof doDia>();
    for (const s of doDia) {
      const lista = porRt.get(s.rtCodigo) ?? [];
      lista.push(s);
      porRt.set(s.rtCodigo, lista);
    }
    const rts = [...porRt.entries()];
    // Uma parada por RT, na ordem da rota — e nao um ponto por chamado.
    const paradas = paradasNavegaveis(
      rts.map(([, doRt]) => ({ lat: doRt[0]?.rtLat ?? null, lng: doRt[0]?.rtLng ?? null })),
    );
    const paradasComCodigo = rts
      .map(([codigo, doRt]) => ({ codigo, lat: doRt[0]?.rtLat ?? null, lng: doRt[0]?.rtLng ?? null }))
      .filter((p): p is { codigo: string; lat: number; lng: number } => p.lat != null && p.lng != null);
    return { dia, rts, navegacao: linkGoogleMapsRota(paradas), paradasComCodigo };
  });

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

      <div className="flex-1 px-4 py-4">
        {servicos.length === 0 ? (
          <p className="mt-8 text-center text-sm text-text-tertiary">
            Nenhum serviço planejado pra você.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {dias.map(({ dia, rts, navegacao, paradasComCodigo }) => (
              <section key={dia}>
                <h2 className="mb-2 text-sm font-semibold text-text-primary">
                  Rota dia {formatoDataCurta.format(new Date(`${dia}T00:00:00`))}
                  {dia === hoje && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-white">
                      hoje
                    </span>
                  )}
                </h2>

                {navegacao && (
                  <a
                    href={navegacao.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mb-3 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-accent bg-accent/5 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 ${FOCUS_RING}`}
                  >
                    <span aria-hidden="true">➤</span>
                    Abrir rota no Google Maps
                  </a>
                )}
                <MapaDoDia paradas={paradasComCodigo} />

                {navegacao?.truncada && (
                  <p className="mb-3 text-xs text-text-tertiary">
                    O Google Maps aceita no máximo 10 paradas por link — este abre as{" "}
                    {navegacao.paradasNoLink} primeiras da rota.
                  </p>
                )}
                <ul className="flex flex-col gap-3">
                  {rts.map(([rtCodigo, doRt]) => (
                    <RtGrupo
                      key={rtCodigo}
                      codigo={rtCodigo}
                      endereco={doRt[0]?.rtEndereco ?? ""}
                      quantidade={doRt.length}
                      urlNavegacao={
                        doRt[0]?.rtLat != null && doRt[0]?.rtLng != null
                          ? linkGoogleMapsDestino({ lat: doRt[0].rtLat, lng: doRt[0].rtLng })
                          : null
                      }
                    >
                  {doRt.map((s, indice) => (
              <li key={s.id}>
                <Link
                  href={`/servico/${s.id}`}
                  className="block rounded-[var(--radius-md)] border border-border bg-surface p-3 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white">
                      {indice + 1}
                    </span>
                    {s.protocolo && (
                      <span className="font-mono text-xs text-text-tertiary">#{s.protocolo}</span>
                    )}
                    {s.criadoEm && (
                      <span className="text-xs text-text-tertiary">
                        criado em {formatoDataCurta.format(new Date(s.criadoEm))}
                      </span>
                    )}
                    {s.reexecucao && (
                      <span className="rounded-full bg-priority-alta/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-priority-alta uppercase">
                        ↩ Retorno
                      </span>
                    )}
                    <span className="ml-auto">
                      <StatusServicoBadge status={s.status} />
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-text-primary">{s.assunto}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <PrioridadeBadge prioridade={s.prioridade} />
                    <SlaBadge slaPrazo={s.slaPrazo} status={s.chamadoStatus} />
                  </div>
                </Link>
              </li>
                  ))}
                    </RtGrupo>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
