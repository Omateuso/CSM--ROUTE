import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./logout-button";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[var(--radius-md)] border border-border bg-surface p-8 text-center">
        <h1 className="text-lg font-semibold text-text-primary">
          Base operacional configurada
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          Logado como <strong>{profile?.nome ?? user.email}</strong>
          {profile?.role && (
            <>
              {" "}
              · perfil <strong>{profile.role}</strong>
            </>
          )}
        </p>
        <p className="mt-4 text-xs text-text-tertiary">
          Placeholder temporário da Parte A — será substituído pelo dashboard
          real ao final da Parte B.
        </p>

        {profile?.role === "gerente" && (
          <div className="mt-6 flex flex-col items-center gap-2 border-t border-border pt-4">
            <Link
              href="/zonas"
              className="rounded-[var(--radius-sm)] text-sm font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
            >
              Zonas e regiões →
            </Link>
            <Link
              href="/rts"
              className="rounded-[var(--radius-sm)] text-sm font-medium text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
            >
              RTs →
            </Link>
          </div>
        )}

        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
