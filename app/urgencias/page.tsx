import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UrgenciasManager } from "./urgencias-manager";
import { haversineKm } from "@/lib/routing/proximity";
import type { UrgenciaRow } from "./types";
import type { UrgenciaStatus } from "./urgencia-status-badge";
import type { Prioridade } from "@/app/chamados/prioridade-badge";

// Mesma situação das demais telas: sem Database types gerados ainda, embed
// aninhado fica ambíguo pro TypeScript (array vs objeto único), embora em
// runtime seja sempre objeto único (FK to-one).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const STATUS_SERVICO_CONCLUIDO = new Set(["concluido_tecnico", "aguardando_validacao", "validado"]);

export default async function UrgenciasPage() {
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

  const hoje = new Date().toISOString().slice(0, 10);

  const [
    { data: urgenciasRaw, error: urgenciasError },
    { data: rtsRaw, error: rtsError },
    { data: rotasHojeRaw, error: rotasError },
  ] = await Promise.all([
    supabase
      .from("urgencias")
      .select(
        "id, codigo, status, rt_id, atendida_por_servico_id, descricao, motivo, solicitante, prioridade, criado_em, rts(codigo, nome, endereco, latitude, longitude, regioes(nome)), chamados(tomticket_id)",
      )
      .order("criado_em", { ascending: false }),
    supabase
      .from("rts")
      .select("id, codigo, endereco, regioes(nome, zonas(nome))")
      .eq("ativo", true)
      .order("codigo", { ascending: true }),
    supabase
      .from("rotas")
      .select("id, equipes(nome)")
      .eq("data", hoje)
      .eq("status", "confirmada"),
  ]);

  if (urgenciasError || rtsError || rotasError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados ({urgenciasError?.message ?? rtsError?.message ?? rotasError?.message}).
        </p>
      </div>
    );
  }

  // Status do serviço que cada urgência em atendimento gerou — é o que
  // distingue "Em atendimento" de "Concluída" na exibição (nunca gravado
  // como valor próprio em urgencias.status, ver migration 0027).
  const servicoIds = [
    ...new Set((urgenciasRaw ?? []).map((u) => u.atendida_por_servico_id as string | null).filter(Boolean)),
  ] as string[];
  const statusPorServico = new Map<string, string>();
  if (servicoIds.length > 0) {
    const { data: servicosRaw } = await supabase.from("servicos").select("id, status").in("id", servicoIds);
    for (const s of servicosRaw ?? []) statusPorServico.set(s.id as string, s.status as string);
  }

  // "Equipe mais próxima hoje" (indicador barato, só Haversine — a
  // estimativa fina com deslocamento real de carro fica pra tela de
  // detalhe, calculada sob demanda depois da urgência validada, mesma
  // disciplina de custo do resto da Rota Inteligente: nunca gastar API paga
  // antes de precisar de verdade).
  const rotaIdsHoje = (rotasHojeRaw ?? []).map((r) => r.id as string);
  const pontosReferenciaHoje: { equipeNome: string; lat: number; lng: number }[] = [];
  if (rotaIdsHoje.length > 0) {
    const { data: paradasHojeRaw } = await supabase
      .from("rota_rts")
      .select("rota_id, rts(latitude, longitude)")
      .in("rota_id", rotaIdsHoje);
    const equipeNomePorRota = new Map(
      (rotasHojeRaw ?? []).map((r) => [r.id as string, unwrapOne(r.equipes)?.nome ?? "—"]),
    );
    for (const p of paradasHojeRaw ?? []) {
      const rt = unwrapOne(p.rts);
      if (!rt) continue;
      pontosReferenciaHoje.push({
        equipeNome: equipeNomePorRota.get(p.rota_id as string) ?? "—",
        lat: Number(rt.latitude),
        lng: Number(rt.longitude),
      });
    }
  }

  function equipeMaisProxima(lat: number, lng: number): { nome: string; distanciaKm: number } | null {
    if (pontosReferenciaHoje.length === 0) return null;
    let melhor: { nome: string; distanciaKm: number } | null = null;
    for (const p of pontosReferenciaHoje) {
      const distanciaKm = haversineKm({ lat, lng }, p);
      if (!melhor || distanciaKm < melhor.distanciaKm) melhor = { nome: p.equipeNome, distanciaKm };
    }
    return melhor;
  }

  const urgencias: UrgenciaRow[] = (urgenciasRaw ?? []).map((u) => {
    const rt = unwrapOne(u.rts);
    const chamado = unwrapOne(u.chamados);
    const status = u.status as UrgenciaRow["status"];
    const servicoStatus = u.atendida_por_servico_id
      ? (statusPorServico.get(u.atendida_por_servico_id as string) ?? null)
      : null;
    const statusDisplay: UrgenciaStatus =
      status === "em_atendimento" && servicoStatus && STATUS_SERVICO_CONCLUIDO.has(servicoStatus)
        ? "concluida"
        : (status as UrgenciaStatus);

    const lat = rt?.latitude != null ? Number(rt.latitude) : null;
    const lng = rt?.longitude != null ? Number(rt.longitude) : null;

    return {
      id: u.id as string,
      codigo: u.codigo as string,
      status,
      statusDisplay,
      rtId: u.rt_id as string,
      rtCodigo: rt?.codigo ?? "—",
      rtNome: rt?.nome ?? "—",
      rtEndereco: rt?.endereco ?? "—",
      regiaoNome: unwrapOne(rt?.regioes)?.nome ?? "—",
      descricao: u.descricao as string,
      motivo: u.motivo as string,
      solicitante: u.solicitante as string,
      prioridade: (u.prioridade as Prioridade | null) ?? null,
      criadoEm: u.criado_em as string,
      tomticketId: (chamado?.tomticket_id as string | null) ?? null,
      equipeMaisProxima: lat != null && lng != null ? equipeMaisProxima(lat, lng) : null,
    };
  });

  const rts = (rtsRaw ?? []).map((rt) => {
    const regiao = unwrapOne(rt.regioes);
    return {
      id: rt.id as string,
      codigo: rt.codigo as string,
      endereco: rt.endereco as string,
      zonaNome: unwrapOne(regiao?.zonas)?.nome ?? "—",
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Execução</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary uppercase">Central de urgências</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Ocorrências excepcionais recebidas fora do ciclo normal de rota — o sistema observa e calcula, quem decide
          é sempre o gerente.
        </p>
      </header>

      <UrgenciasManager urgencias={urgencias} rts={rts} podeGerenciar={role === "gerente"} />
    </div>
  );
}
