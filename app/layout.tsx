import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from "./register-service-worker";
import { AppNav } from "./app-nav";
import { NovasRespostasToast } from "./novas-respostas-toast";
import { createClient } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestão Operacional de Manutenção — RTs",
  description: "Plataforma de gestão operacional de manutenção das Residências Terapêuticas.",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e293b",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // AppNav (menu-pasta) só existe pra gerente/gestão — técnico continua sem
  // ele de propósito (interface mobile-first, "poucos toques por tela"), e
  // deslogado (ex.: /login) nunca teria papel nenhum aqui de qualquer jeito.
  // AppNav envolve `children` (não só a barra): o conteúdo da página É o
  // corpo da pasta, ver app/app-nav.tsx.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: "gerente" | "gestao" | null = null;
  let nome = "";
  let respostasNaoVistas = 0;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("nome, role").eq("id", user.id).single();
    if (profile?.role === "gerente" || profile?.role === "gestao") {
      role = profile.role;
      nome = profile.nome ?? user.email ?? "";
      // Sino global: respostas de cliente ainda não vistas (0036). A RLS
      // restringe a gerente/gestão, então a contagem já vem escopada.
      const { count } = await supabase
        .from("chamado_respostas")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "cliente")
        .is("visto_em", null);
      respostasNaoVistas = count ?? 0;
    }
  }

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {role ? (
          <>
            <AppNav role={role} nome={nome} respostasNaoVistas={respostasNaoVistas}>
              {children}
            </AppNav>
            <NovasRespostasToast />
          </>
        ) : (
          children
        )}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
