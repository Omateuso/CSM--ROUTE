import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Com o menu lateral (gerente/gestão) cobrindo a navegação entre páginas,
// "/" não precisa mais ser um hub de links — cada perfil vai direto pra
// sua página principal. Técnico já ia direto pra /servicos-do-dia desde a
// Fase 3 (interface mobile-first, "poucos toques por tela").
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
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "tecnico") redirect("/servicos-do-dia");
  if (profile?.role === "gerente") redirect("/dashboard");
  if (profile?.role === "gestao") redirect("/painel");

  // Sem role reconhecido (não deveria acontecer em uso normal) — fica
  // aqui só como fallback silencioso, sem tela pra manter.
  redirect("/login");
}
