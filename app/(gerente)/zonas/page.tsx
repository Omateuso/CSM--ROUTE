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

  if (profile?.role !== "gerente") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-text-secondary">
          Essa página é exclusiva do perfil gerente.
        </p>
      </div>
    );
  }

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
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">
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

      <ZonasManager zonas={zonas ?? []} />
    </div>
  );
}
