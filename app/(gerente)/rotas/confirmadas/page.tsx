import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RotasConfirmadasManager, type RotaRow } from "./rotas-confirmadas-manager";

// Mesma situação das demais telas: sem Database types gerados ainda, embed
// aninhado fica ambíguo pro TypeScript (array vs objeto único), embora em
// runtime seja sempre objeto único (FK to-one).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function RotasConfirmadasPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
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
    { data: rotasRaw, error: rotasError },
    { data: rotaRtsRaw, error: rotaRtsError },
    { data: regioesRaw, error: regioesError },
    { data: servicosRaw, error: servicosError },
    { data: extrasRaw, error: extrasError },
    { data: rtsAtivasRaw },
    { data: tecnicosRaw },
  ] = await Promise.all([
    supabase
      .from("rotas")
      .select(
        "id, data, status, confirmada_em, regiao_id, equipe_id, responsavel_id, regioes(nome, zonas(nome)), equipes(nome), responsavel:responsavel_id(nome)",
      )
      .order("data", { ascending: false })
      .order("confirmada_em", { ascending: false }),
    supabase
      .from("rota_rts")
      .select("rota_id, rt_id, ordem, tecnico_id, rts(codigo, endereco), tecnico:tecnico_id(nome)")
      .order("ordem", { ascending: true }),
    supabase.from("regioes").select("id, nome, zonas(nome)").order("nome", { ascending: true }),
    supabase.from("servicos").select("rota_id, rt_id, status"),
    // Atendentes além do principal (migration 0050, 14/09/2026) — a query de
    // `rota_rts` acima só traz `tecnico_id` (o principal); isto complementa
    // com quem mais foi vinculado à mesma parada.
    supabase.from("rota_rts_tecnicos").select("rota_id, rt_id, tecnico_id, tecnico:tecnico_id(nome)"),
    // Editar paradas (0062, 18/09/2026): opções do diálogo "adicionar RT" —
    // RTs ativas e técnicos ativos (filtrados pela equipe da rota no cliente).
    supabase
      .from("rts")
      .select("id, codigo, nome, bairro, regioes(nome)")
      .eq("ativo", true)
      .order("codigo", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, nome, equipe_id")
      .eq("role", "tecnico")
      .eq("ativo", true)
      .order("nome", { ascending: true }),
  ]);

  if (rotasError || rotaRtsError || regioesError || servicosError || extrasError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados (
          {rotasError?.message ?? rotaRtsError?.message ?? regioesError?.message ?? servicosError?.message ??
            extrasError?.message}
          ).
        </p>
      </div>
    );
  }

  // Elegível pra corrigir data (fn_corrigir_data_rota, migration 0016) só
  // quando nenhum serviço da rota saiu de 'planejado' — espelha a mesma
  // checagem que a função faz no servidor, só pra não oferecer o botão à
  // toa (a garantia de verdade é a função, isso aqui é só UX).
  const temServicoIniciadoPorRota = new Set<string>();
  // Por parada (rota + RT): decide se "Remover" aparece no diálogo de editar
  // paradas — mesma regra de fn_remover_parada_rota, só pra não oferecer o
  // botão à toa.
  // Por parada (rota + RT): o diálogo de editar paradas avisa o que a
  // remoção faz — serviço em andamento é cancelado, serviço concluído fica
  // (regra de fn_remover_parada_rota, 0063).
  const paradasEmAndamento = new Set<string>();
  const paradasConcluidas = new Set<string>();
  const EM_ANDAMENTO = new Set(["em_deslocamento", "em_execucao", "em_revisao"]);
  const CONCLUIDO = new Set(["concluido_tecnico", "aguardando_validacao", "validado"]);
  for (const s of servicosRaw ?? []) {
    if (s.status !== "planejado") temServicoIniciadoPorRota.add(s.rota_id as string);
    const chave = `${s.rota_id}-${s.rt_id}`;
    if (EM_ANDAMENTO.has(s.status as string)) paradasEmAndamento.add(chave);
    if (CONCLUIDO.has(s.status as string)) paradasConcluidas.add(chave);
  }

  const regioes = (regioesRaw ?? []).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
    zonaNome: unwrapOne(r.zonas)?.nome ?? "—",
  }));

  // Atendentes além do principal, agrupados por parada (rota_id + rt_id) —
  // o principal (mesmo id) é filtrado na hora de montar cada linha, abaixo.
  const extrasPorParada = new Map<string, { id: string; nome: string }[]>();
  for (const e of extrasRaw ?? []) {
    const chave = `${e.rota_id}-${e.rt_id}`;
    const lista = extrasPorParada.get(chave) ?? [];
    const nome = unwrapOne(e.tecnico)?.nome;
    if (nome) lista.push({ id: e.tecnico_id as string, nome });
    extrasPorParada.set(chave, lista);
  }

  const rtsPorRota = new Map<
    string,
    {
      rtId: string;
      codigo: string;
      endereco: string;
      tecnicoId: string | null;
      tecnicoNome: string | null;
      tecnicosExtraNomes: string[];
    }[]
  >();
  for (const rr of rotaRtsRaw ?? []) {
    const rt = unwrapOne(rr.rts);
    if (!rt) continue;
    const chave = rr.rota_id as string;
    const lista = rtsPorRota.get(chave) ?? [];
    const principalId = rr.tecnico_id as string | null;
    const extras = (extrasPorParada.get(`${rr.rota_id}-${rr.rt_id}`) ?? []).filter(
      (t) => t.id !== principalId,
    );
    lista.push({
      rtId: rr.rt_id as string,
      codigo: rt.codigo as string,
      endereco: rt.endereco as string,
      tecnicoId: principalId,
      tecnicoNome: unwrapOne(rr.tecnico)?.nome ?? null,
      tecnicosExtraNomes: extras.map((t) => t.nome),
    });
    rtsPorRota.set(chave, lista);
  }

  const rotas: RotaRow[] = (rotasRaw ?? []).map((r) => {
    const regiao = unwrapOne(r.regioes);
    return {
      id: r.id as string,
      data: r.data as string,
      status: r.status as string,
      confirmadaEm: r.confirmada_em as string | null,
      regiaoNome: regiao?.nome ?? "—",
      zonaNome: unwrapOne(regiao?.zonas)?.nome ?? "—",
      equipeNome: unwrapOne(r.equipes)?.nome ?? "—",
      responsavelNome: unwrapOne(r.responsavel)?.nome ?? "—",
      equipeId: r.equipe_id as string,
      rts: (rtsPorRota.get(r.id as string) ?? []).map((p) => ({
        ...p,
        emAndamento: paradasEmAndamento.has(`${r.id}-${p.rtId}`),
        concluida: paradasConcluidas.has(`${r.id}-${p.rtId}`),
      })),
      podeCorrigirData: !temServicoIniciadoPorRota.has(r.id as string),
    };
  });

  const rtsDisponiveis = (rtsAtivasRaw ?? []).map((rt) => ({
    id: rt.id as string,
    codigo: rt.codigo as string,
    nome: rt.nome as string,
    bairro: (rt.bairro as string | null) ?? null,
    regiaoNome: unwrapOne(rt.regioes)?.nome ?? "—",
  }));
  const tecnicos = (tecnicosRaw ?? []).map((t) => ({
    id: t.id as string,
    nome: t.nome as string,
    equipeId: (t.equipe_id as string | null) ?? null,
  }));
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
      <header className="mb-6">
        <p className="text-xs font-medium text-text-tertiary">Rotas</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Rotas confirmadas</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Rotas do dia já confirmadas. Nas rotas de hoje e futuras dá pra adicionar ou remover paradas; o que
          já foi concluído pelo técnico continua na Validação.
        </p>
      </header>

      <RotasConfirmadasManager
        rotas={rotas}
        regioes={regioes}
        rtsDisponiveis={rtsDisponiveis}
        tecnicos={tecnicos}
        hoje={hoje}
      />
    </div>
  );
}
