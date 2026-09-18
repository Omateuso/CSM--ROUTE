import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UrgenciasManager } from "./urgencias-manager";
import { haversineKm } from "@/lib/routing/proximity";
import type { UrgenciaRow } from "./types";
import { derivarStatusDisplay } from "./urgencia-status-badge";
import type { Prioridade } from "@/app/chamados/prioridade-badge";
import type { StatusChamado } from "@/app/chamados/status-chamado-badge";
import type { UrgenciaOrigem } from "./urgencia-origem";

// Mesma situação das demais telas: sem Database types gerados ainda, embed
// aninhado fica ambíguo pro TypeScript (array vs objeto único), embora em
// runtime seja sempre objeto único (FK to-one).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

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
    { data: rotasHojeRaw, error: rotasError },
  ] = await Promise.all([
    supabase
      .from("urgencias")
      .select(
        "id, codigo, status, chamado_id, motivo, origem, solicitante, prioridade, criado_em, atendida_por_servico_id, chamados(tomticket_id, assunto, prioridade, status, sla_prazo, rt_id, rts(codigo, nome, endereco, latitude, longitude, regioes(nome)))",
      )
      .order("criado_em", { ascending: false }),
    supabase.from("rotas").select("id, equipes(nome)").eq("data", hoje).eq("status", "confirmada"),
  ]);

  if (urgenciasError || rotasError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados ({urgenciasError?.message ?? rotasError?.message}).
        </p>
      </div>
    );
  }

  // Status do serviço que cada urgência em atendimento gerou — é o que
  // distingue "técnico escalado" / "em atendimento" / "concluída" / "precisa
  // de novo despacho" (ver derivarStatusDisplay acima).
  const servicoIds = [
    ...new Set((urgenciasRaw ?? []).map((u) => u.atendida_por_servico_id as string | null).filter(Boolean)),
  ] as string[];
  const statusPorServico = new Map<string, string>();
  if (servicoIds.length > 0) {
    const { data: servicosRaw } = await supabase.from("servicos").select("id, status").in("id", servicoIds);
    for (const s of servicosRaw ?? []) statusPorServico.set(s.id as string, s.status as string);
  }

  // "Equipe mais próxima hoje" (indicador barato, só Haversine — sem GPS ao
  // vivo do técnico, decisão de 11/09/2026). A estimativa fina com
  // deslocamento real de carro + carga de trabalho fica pra tela de
  // detalhe, calculada sob demanda só depois da urgência validada.
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

  // Localização ESTIMADA do técnico (migration 0057, 15/09/2026) também
  // entra como candidato — mesmo indicador barato (Haversine), sem gasto de
  // provedor de rotas aqui. Um técnico sem rota confirmada hoje (ou parado
  // numa RT fora da rota planejada) ainda pode ser "a pessoa mais perto".
  const { data: localizacoesRaw } = await supabase
    .from("tecnico_localizacao_estimada")
    .select("latitude, longitude, tecnico:tecnico_id(nome, equipes(nome))");
  for (const l of localizacoesRaw ?? []) {
    const tecnico = unwrapOne(l.tecnico);
    const equipeNome = tecnico ? unwrapOne(tecnico.equipes)?.nome : null;
    if (!equipeNome) continue; // técnico sem equipe não tem "equipe mais próxima" pra atribuir
    pontosReferenciaHoje.push({ equipeNome, lat: Number(l.latitude), lng: Number(l.longitude) });
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
    const chamado = unwrapOne(u.chamados);
    const rt = chamado ? unwrapOne(chamado.rts) : null;
    const status = u.status as UrgenciaRow["status"];
    const servicoStatus = u.atendida_por_servico_id
      ? (statusPorServico.get(u.atendida_por_servico_id as string) ?? null)
      : null;

    const lat = rt?.latitude != null ? Number(rt.latitude) : null;
    const lng = rt?.longitude != null ? Number(rt.longitude) : null;

    return {
      id: u.id as string,
      codigo: u.codigo as string,
      status,
      statusDisplay: derivarStatusDisplay(status, servicoStatus),
      chamadoId: u.chamado_id as string,
      tomticketId: (chamado?.tomticket_id as string | null) ?? null,
      chamadoAssunto: chamado?.assunto ?? "—",
      chamadoPrioridade: (chamado?.prioridade as Prioridade) ?? "normal",
      chamadoStatus: (chamado?.status as StatusChamado) ?? "aberto",
      chamadoSlaPrazo: (chamado?.sla_prazo as string | null) ?? null,
      rtCodigo: rt?.codigo ?? "—",
      rtNome: rt?.nome ?? "—",
      rtEndereco: rt?.endereco ?? "—",
      regiaoNome: unwrapOne(rt?.regioes)?.nome ?? "—",
      motivo: u.motivo as string,
      origem: u.origem as UrgenciaOrigem,
      solicitante: u.solicitante as string,
      prioridadeUrgencia: (u.prioridade as Prioridade | null) ?? null,
      criadoEm: u.criado_em as string,
      equipeMaisProxima: lat != null && lng != null ? equipeMaisProxima(lat, lng) : null,
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
      <header className="mb-6">
        <p className="text-xs font-medium text-text-tertiary">Execução</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Central de urgências</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Ocorrências excepcionais recebidas fora do ciclo normal de rota — o sistema observa e calcula, quem decide
          é sempre o gerente. Toda urgência parte de um chamado já existente; nada é cadastrado de novo aqui.
        </p>
      </header>

      <UrgenciasManager urgencias={urgencias} podeGerenciar={role === "gerente"} />
    </div>
  );
}
