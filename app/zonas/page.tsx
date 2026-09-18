import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ZonasManager } from "./zonas-manager";

export default async function ZonasPage() {
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

  const role = profile?.role;
  if (role !== "gerente" && role !== "gestao") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          Essa página é exclusiva dos perfis gerente e gestão.
        </p>
      </div>
    );
  }

  // Criar zona/região continua com o gerente; renomear/excluir passou a
  // ser exclusivo da gestão (migration 0013, decisão de 17/08/2026) — a
  // RLS é quem impede de fato, isso aqui só evita mostrar um botão que a
  // API vai recusar.
  const podeCriar = role === "gerente";
  const podeEditar = role === "gestao";

  const { data: zonas, error } = await supabase
    .from("zonas")
    .select("id, nome, regioes(id, nome)")
    .order("nome", { ascending: true })
    .order("nome", { referencedTable: "regioes", ascending: true });

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-danger">
          Não foi possível carregar as zonas ({error.message}).
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="text-xs font-medium text-text-tertiary">
          Cadastro
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text-primary">
          Zonas e regiões
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Base territorial usada por RTs, rotas e filtros. Cada zona agrupa
          uma ou mais regiões — ex.: Zona Oeste contém Campo Grande, Santa
          Cruz e Bangu.
        </p>
      </header>

      <ZonasManager zonas={zonas ?? []} podeCriar={podeCriar} podeEditar={podeEditar} />
    </div>
  );
}
