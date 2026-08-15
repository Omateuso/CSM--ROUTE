import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RtsManager } from "./rts-manager";

// Sem Database types gerados pro client do Supabase ainda — o embed
// aninhado (rts.regioes / regioes.zonas) fica ambíguo pro TypeScript
// (array vs objeto único), embora em runtime seja sempre um objeto único
// (é um FK to-one). Normaliza aqui, uma vez só, pra o resto do app
// trabalhar com tipos limpos e simples.
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function RtsPage() {
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

  const [{ data: rtsRaw, error: rtsError }, { data: regioesRaw, error: regioesError }] = await Promise.all([
    supabase
      .from("rts")
      .select(
        "id, codigo, nome, endereco, bairro, latitude, longitude, ativo, regiao_id, regioes(nome, zonas(nome))",
      )
      .order("codigo", { ascending: true }),
    supabase
      .from("regioes")
      .select("id, nome, zonas(nome)")
      .order("nome", { ascending: true }),
  ]);

  if (rtsError || regioesError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados ({rtsError?.message ?? regioesError?.message}).
        </p>
      </div>
    );
  }

  const regioes = (regioesRaw ?? []).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
    zonaNome: unwrapOne(r.zonas)?.nome ?? "—",
  }));

  const rts = (rtsRaw ?? []).map((rt) => {
    const regiao = unwrapOne(rt.regioes);
    return {
      id: rt.id as string,
      codigo: rt.codigo as string,
      nome: rt.nome as string,
      endereco: rt.endereco as string,
      bairro: rt.bairro as string,
      latitude: rt.latitude as number,
      longitude: rt.longitude as number,
      ativo: rt.ativo as boolean,
      regiao_id: rt.regiao_id as string,
      regiaoNome: regiao?.nome ?? "—",
      zonaNome: unwrapOne(regiao?.zonas)?.nome ?? "—",
    };
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">
          Cadastro
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">RTs</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Residências Terapêuticas atendidas — endereço, localização e região
          de cada uma. Base usada pelo mapa, pelas rotas e pelos chamados.
        </p>
      </header>

      <RtsManager rts={rts} regioes={regioes} />
    </div>
  );
}
