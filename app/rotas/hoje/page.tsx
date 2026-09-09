import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FOCUS_RING } from "@/lib/ui/styles";
import { RotaHojeMapa } from "./rota-hoje-mapa";
import { RotasHojeLista } from "./rotas-hoje-lista";
import { RotaHojeRealtime } from "./rota-hoje-realtime";
import type { ParadaStatus, RotaHoje, TecnicoAoVivo } from "./tipos";

function unwrapOne<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}
function unwrapMany<T>(v: T | T[] | null | undefined): T[] {
  if (Array.isArray(v)) return v;
  return v ? [v] : [];
}

// Status agregado de uma parada (RT) a partir dos serviços dela:
//  - concluida: todo serviço já saiu de "planejado"/"em_execucao" (ou não há serviço)
//  - em_andamento: algum serviço "em_execucao"
//  - nao_iniciada: resto (algum ainda "planejado", nenhum em execução)
function statusDaParada(statuses: string[]): ParadaStatus {
  if (statuses.some((s) => s === "em_execucao")) return "em_andamento";
  const pendentes = statuses.filter((s) => s === "planejado");
  if (pendentes.length === 0) return "concluida";
  if (pendentes.length < statuses.length) return "em_andamento";
  return "nao_iniciada";
}

// Paleta pros pins/trilhas dos técnicos (distinta da paleta operacional de
// prioridade/SLA — aqui é só "qual técnico é qual").
const CORES_TECNICO = ["#2563eb", "#7c3aed", "#db2777", "#0891b2", "#ca8a04", "#4f46e5"];

export default async function RotaDoDiaPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();
  const role = profile?.role as "gerente" | "gestao" | "tecnico" | undefined;
  if (role !== "gerente" && role !== "gestao") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Essa página é exclusiva de gerente e gestão.</p>
      </div>
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);

  const { data: rotasRaw, error } = await supabase
    .from("rotas")
    .select(
      "id, status, equipe:equipe_id(nome), regiao:regiao_id(nome), rota_rts(ordem, rt_id, tecnico_id, rts(codigo, nome, endereco, latitude, longitude)), servicos(id, rt_id, status, tecnico_id, tecnico:tecnico_id(nome), chamados(assunto, prioridade, tomticket_id))",
    )
    .eq("data", hoje)
    .eq("status", "confirmada");

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">Não foi possível carregar (${error.message}).</p>
      </div>
    );
  }

  // ids de técnicos escalados hoje (parada + serviço) — pra buscar a posição.
  const tecnicoIds = [
    ...new Set(
      (rotasRaw ?? []).flatMap((r) => [
        ...unwrapMany(r.rota_rts).map((p) => p.tecnico_id as string | null),
        ...unwrapMany(r.servicos).map((s) => s.tecnico_id as string | null),
      ]),
    ),
  ].filter((x): x is string => Boolean(x));

  const nomePorTecnico = new Map<string, string>();
  const cargoPorTecnico = new Map<string, string>();
  for (const r of rotasRaw ?? []) {
    for (const s of unwrapMany(r.servicos)) {
      const nome = unwrapOne(s.tecnico)?.nome;
      if (s.tecnico_id && nome) nomePorTecnico.set(s.tecnico_id as string, nome);
    }
  }
  // nome dos técnicos que aparecem só em rota_rts (parada sem serviço ainda)
  const faltamNome = tecnicoIds.filter((id) => !nomePorTecnico.has(id));
  if (faltamNome.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", faltamNome);
    for (const p of profs ?? []) nomePorTecnico.set(p.id as string, (p.nome as string) ?? "Técnico");
  }
  void cargoPorTecnico;

  // Trilha do dia (pings) dos técnicos escalados.
  const trilhaPorTecnico = new Map<string, { lat: number; lng: number; em: string }[]>();
  if (tecnicoIds.length > 0) {
    const { data: pings } = await supabase
      .from("tecnico_posicao")
      .select("tecnico_id, latitude, longitude, capturado_em")
      .in("tecnico_id", tecnicoIds)
      .gte("capturado_em", `${hoje}T00:00:00`)
      .order("capturado_em", { ascending: true });
    for (const p of pings ?? []) {
      const id = p.tecnico_id as string;
      const lista = trilhaPorTecnico.get(id) ?? [];
      lista.push({
        lat: Number(p.latitude),
        lng: Number(p.longitude),
        em: p.capturado_em as string,
      });
      trilhaPorTecnico.set(id, lista);
    }
  }

  const rotas: RotaHoje[] = (rotasRaw ?? []).map((r) => {
    const servicosPorRt = new Map<string, string[]>();
    const servicosDetPorRt = new Map<
      string,
      { status: string; assunto: string; prioridade: string; protocolo: string | null }[]
    >();
    for (const s of unwrapMany(r.servicos)) {
      const rtId = s.rt_id as string;
      const st = s.status as string;
      servicosPorRt.set(rtId, [...(servicosPorRt.get(rtId) ?? []), st]);
      const ch = unwrapOne(s.chamados);
      servicosDetPorRt.set(rtId, [
        ...(servicosDetPorRt.get(rtId) ?? []),
        {
          status: st,
          assunto: ch?.assunto ?? "—",
          prioridade: (ch?.prioridade as string) ?? "normal",
          protocolo: (ch?.tomticket_id as string | null) ?? null,
        },
      ]);
    }

    const paradas = unwrapMany(r.rota_rts)
      .slice()
      .sort((a, b) => (a.ordem as number) - (b.ordem as number))
      .map((p) => {
        const rt = unwrapOne(p.rts);
        const rtId = p.rt_id as string;
        const statuses = servicosPorRt.get(rtId) ?? [];
        return {
          ordem: p.ordem as number,
          rtId,
          rtCodigo: rt?.codigo ?? "—",
          rtNome: rt?.nome ?? "—",
          rtEndereco: rt?.endereco ?? "—",
          lat: rt?.latitude != null ? Number(rt.latitude) : null,
          lng: rt?.longitude != null ? Number(rt.longitude) : null,
          tecnicoId: (p.tecnico_id as string | null) ?? null,
          tecnicoNome: p.tecnico_id ? (nomePorTecnico.get(p.tecnico_id as string) ?? "Técnico") : null,
          status: statuses.length > 0 ? statusDaParada(statuses) : ("nao_iniciada" as ParadaStatus),
          servicos: servicosDetPorRt.get(rtId) ?? [],
        };
      });

    const feitas = paradas.filter((p) => p.status === "concluida").length;

    return {
      id: r.id as string,
      equipeNome: unwrapOne(r.equipe)?.nome ?? "—",
      regiaoNome: unwrapOne(r.regiao)?.nome ?? "—",
      progresso: { feitas, total: paradas.length },
      paradas,
    };
  });

  const tecnicos: TecnicoAoVivo[] = tecnicoIds.map((id, i) => {
    const trilha = trilhaPorTecnico.get(id) ?? [];
    const ultima = trilha[trilha.length - 1] ?? null;
    return {
      id,
      nome: nomePorTecnico.get(id) ?? "Técnico",
      cor: CORES_TECNICO[i % CORES_TECNICO.length],
      trilha: trilha.map((t) => ({ lat: t.lat, lng: t.lng })),
      ultima: ultima ? { lat: ultima.lat, lng: ultima.lng, em: ultima.em } : null,
    };
  });

  const totalParadas = rotas.reduce((acc, r) => acc + r.progresso.total, 0);
  const totalFeitas = rotas.reduce((acc, r) => acc + r.progresso.feitas, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <RotaHojeRealtime />
      <header className="mb-6">
        <p className="font-mono text-xs tracking-wider text-text-tertiary uppercase">Operação</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Rota do dia</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          As rotas confirmadas de hoje no mapa — cada parada muda de cor conforme o técnico avança, e o
          pin acompanha a posição de quem está com o app aberto.{" "}
          <span className="inline-flex items-center gap-1 align-middle text-xs text-sla-dentro">
            <span aria-hidden="true">●</span> ao vivo
          </span>
        </p>
      </header>

      {rotas.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm text-text-secondary">Nenhuma rota confirmada para hoje.</p>
          {role === "gerente" && (
            <Link
              href="/rotas/montar"
              className={`mt-3 inline-block text-sm font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
            >
              Montar uma rota →
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-text-secondary">
            {rotas.length} rota{rotas.length > 1 ? "s" : ""} · {totalFeitas} de {totalParadas} paradas
            concluídas
          </p>
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className="h-[420px] lg:h-[600px]">
              <RotaHojeMapa rotas={rotas} tecnicos={tecnicos} />
            </div>
            <RotasHojeLista rotas={rotas} tecnicos={tecnicos} />
          </div>
        </>
      )}
    </div>
  );
}
