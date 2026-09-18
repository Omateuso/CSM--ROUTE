import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeSlaStatus } from "@/lib/sla";
import { MapaClient, type RtMarker } from "./mapa-client";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";

const STATUS_ABERTO = new Set(["aberto", "em_andamento"]);

type Nivel = "critico" | "emergencial" | "vencido" | "alta" | "ok" | "sem_chamados";

// Nível de atenção de uma RT = pior condição entre os chamados em aberto
// vinculados a ela. "critico" (emergencial + SLA vencido ao mesmo tempo) é
// o único nível acima de "emergencial" — regra de negócio do CLAUDE.md: os
// dois eixos (prioridade e SLA) são independentes, mas quando colidem no
// mesmo chamado isso precisa se destacar mais que qualquer um dos dois
// sozinho, não ser tratado como "só mais um chamado antigo".
function calcularNivel(temEmergencial: boolean, temVencido: boolean, temAlta: boolean, totalAbertos: number): Nivel {
  if (temEmergencial && temVencido) return "critico";
  if (temEmergencial) return "emergencial";
  if (temVencido) return "vencido";
  if (temAlta) return "alta";
  if (totalAbertos > 0) return "ok";
  return "sem_chamados";
}

export default async function MapaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "gerente") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          Essa página é exclusiva do perfil gerente.
        </p>
      </div>
    );
  }

  const [
    { data: rtsRaw, error: rtsError },
    { data: chamadosRaw, error: chamadosError },
  ] = await Promise.all([
    supabase
      .from("rts")
      .select("id, codigo, nome, endereco, latitude, longitude, ativo")
      .eq("ativo", true),
    todasAsLinhas(() => supabase.from("chamados").select("rt_id, prioridade, status, sla_prazo").order("id")),
  ]);

  if (rtsError || chamadosError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados ({rtsError?.message ?? chamadosError?.message}).
        </p>
      </div>
    );
  }

  const porRt = new Map<
    string,
    { total: number; emergencial: number; vencido: number; alta: number }
  >();

  for (const c of chamadosRaw ?? []) {
    if (!STATUS_ABERTO.has(c.status as string)) continue;
    const chave = c.rt_id as string;
    const atual = porRt.get(chave) ?? { total: 0, emergencial: 0, vencido: 0, alta: 0 };
    atual.total++;
    if (c.prioridade === "emergencial") atual.emergencial++;
    if (c.prioridade === "alta") atual.alta++;
    if (computeSlaStatus(c.sla_prazo as string | null) === "vencido") atual.vencido++;
    porRt.set(chave, atual);
  }

  const rts: RtMarker[] = (rtsRaw ?? []).map((rt) => {
    const resumo = porRt.get(rt.id as string) ?? { total: 0, emergencial: 0, vencido: 0, alta: 0 };
    return {
      id: rt.id as string,
      codigo: rt.codigo as string,
      nome: rt.nome as string,
      endereco: rt.endereco as string,
      lat: Number(rt.latitude),
      lng: Number(rt.longitude),
      totalAbertos: resumo.total,
      emergenciais: resumo.emergencial,
      vencidos: resumo.vencido,
      nivel: calcularNivel(resumo.emergencial > 0, resumo.vencido > 0, resumo.alta > 0, resumo.total),
    };
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto w-full max-w-6xl px-4 pt-7 pb-5 sm:px-6 sm:pt-10 sm:pb-6">
        <p className="text-xs font-medium text-text-tertiary">
          Visão geral
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Mapa operacional</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          RTs plotadas por localização real, coloridas pelo nível de atenção
          dos chamados em aberto. Clique numa RT pra ver o detalhe.
        </p>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-8 sm:px-6 sm:pb-10">
        <MapaClient rts={rts} />
      </div>
    </div>
  );
}
