import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from "./register-service-worker";
import { AppNav } from "./app-nav";
import { NovasRespostasToast } from "./novas-respostas-toast";
import { createClient } from "@/lib/supabase/server";
import type { Tema } from "@/lib/ui/theme-toggle";

// IBM Plex (18/09/2026, nova identidade visual): voz técnica de formulário
// de OS/ordem de serviço, ótimos números tabulares e acentos do português;
// Plex Mono só pra dado estrutural (placa da RT, protocolo, horário).
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Gestão Operacional de Manutenção — RTs",
  description: "Plataforma de gestão operacional de manutenção das Residências Terapêuticas.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // iOS não lê o manifest.json pra decidir se "Adicionar à Tela de Início"
  // abre em standalone (sem a barra de endereço) — só essas duas meta tags
  // fazem isso lá. Sem `capable`, o atalho do iPhone abre dentro do Safari
  // normal, sem parecer um app instalado de verdade. `statusBarStyle:
  // "default"` (barra clara) porque o app não usa viewport-fit=cover — o
  // conteúdo já nasce abaixo da barra de status, sem precisar compensar
  // notch com safe-area.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gestão RTs",
  },
};

export const viewport: Viewport = {
  // Barra do navegador acompanha o tema do sistema; a preferência explícita
  // (cookie) não chega aqui, mas a diferença é só o tom da barra.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b6e68" },
    { media: "(prefers-color-scheme: dark)", color: "#161514" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // AppNav (menu lateral) só existe pra gerente/gestão — técnico continua sem
  // ele de propósito (interface mobile-first, "poucos toques por tela"), e
  // deslogado (ex.: /login) nunca teria papel nenhum aqui de qualquer jeito.
  // AppNav envolve `children` (não só a barra): o conteúdo da página é o
  // painel ao lado do menu, ver app/app-nav.tsx.
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

  // Menu aberto ou recolhido: preferência lida aqui, no servidor, e passada
  // como prop — servidor e cliente renderizam o mesmo estado desde o
  // primeiro paint. Ler isso de localStorage num efeito daria descasamento
  // de hidratação e exigiria `setState` dentro de efeito. Padrão = aberto.
  const cookieStore = await cookies();
  const menuAberto = cookieStore.get("menu-lateral")?.value !== "0";
  // Tema (18/09/2026): preferência explícita vira `data-theme` no <html> já
  // no servidor — sem flash. Sem cookie, o CSS segue o sistema
  // (prefers-color-scheme), ver app/globals.css.
  const temaCookie = cookieStore.get("tema")?.value;
  const tema: Tema = temaCookie === "dark" || temaCookie === "light" ? temaCookie : null;

  return (
    <html
      lang="pt-BR"
      data-theme={tema ?? undefined}
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {role ? (
          <>
            <AppNav
              role={role}
              nome={nome}
              respostasNaoVistas={respostasNaoVistas}
              menuAberto={menuAberto}
              tema={tema}
            >
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
