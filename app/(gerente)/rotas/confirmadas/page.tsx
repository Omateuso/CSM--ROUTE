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
      .select("rota_id, ordem, rts(codigo, endereco), tecnico:tecnico_id(nome)")
      .order("ordem", { ascending: true }),
    supabase.from("regioes").select("id, nome, zonas(nome)").order("nome", { ascending: true }),
    supabase.from("servicos").select("rota_id, status"),
  ]);

  if (rotasError || rotaRtsError || regioesError || servicosError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados (
          {rotasError?.message ?? rotaRtsError?.message ?? regioesError?.message ?? servicosError?.message}).
        </p>
      </div>
    );
  }

  // Elegível pra corrigir data (fn_corrigir_data_rota, migration 0016) só
  // quando nenhum serviço da rota saiu de 'planejado' — espelha a mesma
  // checagem que a função faz no servidor, só pra não oferecer o botão à
  // toa (a garantia de verdade é a função, isso aqui é só UX).
  const temServicoIniciadoPorRota = new Set<string>();
  for (const s of servicosRaw ?? []) {
    if (s.status !== "planejado") temServicoIniciadoPorRota.add(s.rota_id as string);
  }

  const regioes = (regioesRaw ?? []).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
    zonaNome: unwrapOne(r.zonas)?.nome ?? "—",
  }));

  const rtsPorRota = new Map<string, { codigo: string; endereco: string; tecnicoNome: string | null }[]>();
  for (const rr of rotaRtsRaw ?? []) {
    const rt = unwrapOne(rr.rts);
    if (!rt) continue;
    const chave = rr.rota_id as string;
    const lista = rtsPorRota.get(chave) ?? [];
    lista.push({
      codigo: rt.codigo as string,
      endereco: rt.endereco as string,
      tecnicoNome: unwrapOne(rr.tecnico)?.nome ?? null,
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
      rts: rtsPorRota.get(r.id as string) ?? [],
      podeCorrigirData: !temServicoIniciadoPorRota.has(r.id as string),
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Rotas</p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Rotas confirmadas</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Histórico de rotas do dia já confirmadas — registro fixo, não editável por aqui.
        </p>
      </header>

      <RotasConfirmadasManager rotas={rotas} regioes={regioes} />
    </div>
  );
}
