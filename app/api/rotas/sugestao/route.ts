import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeSlaStatus } from "@/lib/sla";
import { sugerirProximasRts, type RtParaRoteirizacao } from "@/lib/routing/intelligent-route";
import { ROUTE_PROXIMITY_RADIUS_KM } from "@/lib/routing/config";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";

// Raios que o gerente pode escolher na tela (pedido do usuário, 27/08/2026)
// — validados aqui pra não aceitar valor arbitrário vindo do client.
const RAIOS_PERMITIDOS_KM = [5, 10, 15, 20, 25];

// Lógica de sugestão de rota fica inteira no servidor (item 17 do spec da
// Fase 2/Parte B) — nunca no client. Isso também é onde a chave do provedor
// de rotas (ORS) é usada, então nunca pode virar código client-side.
const STATUS_ABERTO = new Set(["aberto", "em_andamento"]);

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "gerente") {
    return NextResponse.json({ error: "Exclusivo do perfil gerente." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const referenciaRtId = typeof body.referenciaRtId === "string" ? body.referenciaRtId : null;
  const regiaoId = typeof body.regiaoId === "string" ? body.regiaoId : null;
  const jaSelecionadas: string[] = Array.isArray(body.jaSelecionadas)
    ? body.jaSelecionadas.filter((v: unknown): v is string => typeof v === "string")
    : [];
  const raioKm =
    typeof body.raioKm === "number" && RAIOS_PERMITIDOS_KM.includes(body.raioKm)
      ? body.raioKm
      : ROUTE_PROXIMITY_RADIUS_KM;

  const [{ data: rtsRaw, error: rtsError }, { data: chamadosRaw, error: chamadosError }] = await Promise.all([
    supabase
      .from("rts")
      .select("id, codigo, nome, endereco, latitude, longitude, regiao_id, ativo")
      .eq("ativo", true),
    todasAsLinhas(() => supabase.from("chamados").select("rt_id, prioridade, status, sla_prazo").order("id")),
  ]);

  if (rtsError || chamadosError) {
    return NextResponse.json(
      { error: rtsError?.message ?? chamadosError?.message ?? "Erro ao carregar dados." },
      { status: 500 },
    );
  }

  const porRt = new Map<
    string,
    { total: number; emergencial: number; alta: number; vencido: number; proximo: number }
  >();
  for (const c of chamadosRaw ?? []) {
    if (!STATUS_ABERTO.has(c.status as string)) continue;
    const chave = c.rt_id as string;
    const atual = porRt.get(chave) ?? { total: 0, emergencial: 0, alta: 0, vencido: 0, proximo: 0 };
    atual.total++;
    if (c.prioridade === "emergencial") atual.emergencial++;
    if (c.prioridade === "alta") atual.alta++;
    const slaStatus = computeSlaStatus(c.sla_prazo as string | null);
    if (slaStatus === "vencido") atual.vencido++;
    if (slaStatus === "proximo") atual.proximo++;
    porRt.set(chave, atual);
  }

  const todasRts: RtParaRoteirizacao[] = (rtsRaw ?? []).map((r) => {
    const resumo = porRt.get(r.id as string) ?? {
      total: 0,
      emergencial: 0,
      alta: 0,
      vencido: 0,
      proximo: 0,
    };
    return {
      id: r.id as string,
      codigo: r.codigo as string,
      nome: r.nome as string,
      endereco: r.endereco as string,
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      regiaoId: r.regiao_id as string,
      totalAbertos: resumo.total,
      emergenciais: resumo.emergencial,
      altas: resumo.alta,
      vencidos: resumo.vencido,
      proximos: resumo.proximo,
    };
  });

  try {
    const resultado = await sugerirProximasRts({ todasRts, referenciaRtId, regiaoId, jaSelecionadas, raioKm });
    return NextResponse.json(resultado);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao calcular sugestão de rota." },
      { status: 502 },
    );
  }
}
