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
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">
          Base operacional configurada
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Logado como <strong>{profile?.nome ?? user.email}</strong>
          {profile?.role && (
            <>
              {" "}
              · perfil <strong>{profile.role}</strong>
            </>
          )}
        </p>
        <p className="mt-4 text-xs text-zinc-400">
          Placeholder temporário da Parte A — será substituído pelo dashboard
          real na Parte B.
        </p>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
