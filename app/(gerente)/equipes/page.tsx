import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EquipesManager } from "./equipes-manager";

// Mesma situação das demais telas: sem Database types gerados ainda, embed
// aninhado fica ambíguo pro TypeScript (array vs objeto único), embora em
// runtime seja sempre objeto único (FK to-one).
function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function EquipesPage() {
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
    { data: equipesRaw, error: equipesError },
    { data: zonasRaw, error: zonasError },
    { data: pessoasRaw, error: pessoasError },
  ] = await Promise.all([
    supabase
      .from("equipes")
      .select("id, nome, ativo, zona_padrao_id, responsavel_id, zonas(nome), responsavel:responsavel_id(nome)")
      .order("nome", { ascending: true }),
    supabase.from("zonas").select("id, nome").order("nome", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, nome, telefone, role, equipe_id, ativo")
      .in("role", ["tecnico", "gerente"])
      .order("nome", { ascending: true }),
  ]);

  if (equipesError || zonasError || pessoasError) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar os dados (
          {equipesError?.message ?? zonasError?.message ?? pessoasError?.message}).
        </p>
      </div>
    );
  }

  const zonas = (zonasRaw ?? []).map((z) => ({ id: z.id as string, nome: z.nome as string }));

  const responsaveis = (pessoasRaw ?? []).map((p) => ({
    id: p.id as string,
    nome: p.nome as string,
  }));

  const equipes = (equipesRaw ?? []).map((e) => {
    return {
      id: e.id as string,
      nome: e.nome as string,
      ativo: e.ativo as boolean,
      zonaPadraoId: e.zona_padrao_id as string | null,
      responsavelId: e.responsavel_id as string | null,
      zonaPadraoNome: unwrapOne(e.zonas)?.nome ?? null,
      responsavelNome: unwrapOne(e.responsavel)?.nome ?? null,
    };
  });

  const tecnicos = (pessoasRaw ?? [])
    .filter((p) => p.role === "tecnico")
    .map((p) => ({
      id: p.id as string,
      nome: p.nome as string,
      telefone: p.telefone as string | null,
      equipeId: p.equipe_id as string | null,
      ativo: p.ativo as boolean,
    }));

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">
          Cadastro
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">Equipes e técnicos</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Organize os técnicos em equipes — base pra montar as rotas do dia
          (Fase 2). Contas de técnico são criadas fora daqui; aqui você só
          vincula um técnico já existente a uma equipe.
        </p>
      </header>

      <EquipesManager
        equipes={equipes}
        zonas={zonas}
        responsaveis={responsaveis}
        tecnicos={tecnicos}
      />
    </div>
  );
}
