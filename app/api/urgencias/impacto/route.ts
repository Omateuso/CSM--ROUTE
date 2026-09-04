import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcularImpactoUrgencia, type RotaAtivaHoje, type ParadaRota } from "@/lib/routing/urgencia-impacto";

// Mesma situação das demais telas: sem Database types gerados ainda, embed
// aninhado fica ambíguo pro TypeScript (array vs objeto único), embora em
// runtime seja sempre objeto único (FK to-one).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const STATUS_SERVICO_PENDENTE = new Set(["planejado", "em_execucao"]);

// Calcula, sob demanda (só quando a tela de detalhe de uma urgência VALIDADA
// pede), o impacto estimado de inserir a urgência em cada rota confirmada e
// ativa hoje — nunca antes disso (custo de API só quando faz sentido, mesma
// disciplina do /api/rotas/sugestao). Lógica sensível fica inteira no
// servidor (item 17 do spec original da Rota Inteligente, que vale aqui
// também).
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
  const urgenciaId = typeof body?.urgenciaId === "string" ? body.urgenciaId : null;
  if (!urgenciaId) {
    return NextResponse.json({ error: "Informe a urgência." }, { status: 400 });
  }

  const { data: urgencia, error: urgenciaError } = await supabase
    .from("urgencias")
    .select("id, rt_id, rts(codigo, latitude, longitude)")
    .eq("id", urgenciaId)
    .maybeSingle();

  if (urgenciaError || !urgencia) {
    return NextResponse.json({ error: urgenciaError?.message ?? "Urgência não encontrada." }, { status: 404 });
  }

  const rt = unwrapOne(urgencia.rts);
  if (!rt) {
    return NextResponse.json({ error: "RT da urgência não encontrada." }, { status: 404 });
  }

  const hoje = new Date().toISOString().slice(0, 10);

  const { data: rotasRaw, error: rotasError } = await supabase
    .from("rotas")
    .select("id, equipe_id, equipes(nome)")
    .eq("data", hoje)
    .eq("status", "confirmada");

  if (rotasError) {
    return NextResponse.json({ error: rotasError.message }, { status: 500 });
  }

  const rotaIds = (rotasRaw ?? []).map((r) => r.id as string);
  if (rotaIds.length === 0) {
    return NextResponse.json({ opcoes: [] });
  }

  const [{ data: paradasRaw, error: paradasError }, { data: servicosRaw, error: servicosError }] = await Promise.all(
    [
      supabase
        .from("rota_rts")
        .select("rota_id, rt_id, ordem, rts(codigo, latitude, longitude), tecnico:tecnico_id(nome)")
        .in("rota_id", rotaIds)
        .order("ordem", { ascending: true }),
      supabase.from("servicos").select("rota_id, rt_id, status").in("rota_id", rotaIds),
    ],
  );

  if (paradasError || servicosError) {
    return NextResponse.json({ error: paradasError?.message ?? servicosError?.message }, { status: 500 });
  }

  // uma parada (rota_id+rt_id) conta como "pendente" se pelo menos um dos
  // serviços dela ainda está planejado/em_execucao — sem nenhum serviço ali
  // (ou todos já em estado terminal), conta como "feita" pra fins de achar a
  // posição atual da equipe hoje.
  const paradasPendentes = new Set<string>();
  for (const s of servicosRaw ?? []) {
    if (STATUS_SERVICO_PENDENTE.has(s.status as string)) {
      paradasPendentes.add(`${s.rota_id}-${s.rt_id}`);
    }
  }

  const rotasPorId = new Map(
    (rotasRaw ?? []).map((r) => [
      r.id as string,
      { equipeId: r.equipe_id as string, equipeNome: unwrapOne(r.equipes)?.nome ?? "—" },
    ]),
  );

  const paradasPorRota = new Map<string, ParadaRota[]>();
  for (const p of paradasRaw ?? []) {
    const rtParada = unwrapOne(p.rts);
    if (!rtParada) continue;
    const chave = p.rota_id as string;
    const lista = paradasPorRota.get(chave) ?? [];
    lista.push({
      rtId: p.rt_id as string,
      codigo: rtParada.codigo as string,
      lat: Number(rtParada.latitude),
      lng: Number(rtParada.longitude),
      ordem: p.ordem as number,
      tecnicoNome: unwrapOne(p.tecnico)?.nome ?? null,
      feita: !paradasPendentes.has(`${chave}-${p.rt_id}`),
    });
    paradasPorRota.set(chave, lista);
  }

  const rotasAtivas: RotaAtivaHoje[] = rotaIds
    .map((rotaId) => {
      const info = rotasPorId.get(rotaId);
      const paradas = paradasPorRota.get(rotaId) ?? [];
      if (!info || paradas.length === 0) return null;
      return { rotaId, equipeId: info.equipeId, equipeNome: info.equipeNome, paradas };
    })
    .filter((r): r is RotaAtivaHoje => r !== null);

  try {
    const opcoes = await calcularImpactoUrgencia(
      { lat: Number(rt.latitude), lng: Number(rt.longitude) },
      rotasAtivas,
    );
    return NextResponse.json({ opcoes });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao calcular impacto da urgência." },
      { status: 502 },
    );
  }
}
