"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";
import { NAV_LINKS } from "./nav-links";
import { NavIcons } from "./nav-icons";
import styles from "./app-nav.module.css";

// Menu lateral retrátil (10/09/2026) — substitui o menu-pasta de 26/08.
//
// Motivo, relatado pelo usuário: no menu-pasta a aba clicada era REMOVIDA da
// fileira (`links.filter(...)`) e redesenhada como lingueta na primeira
// posição. A lista inteira se rearranjava a cada clique e o item recém
// escolhido aparecia longe de onde estava. Aqui TODOS os links são
// renderizados sempre, na mesma ordem de `NAV_LINKS`, e o ativo só muda de
// aparência no lugar em que já estava. Nada de FLIP, filtro ou medição.
//
// A semântica mudou junto, por consequência: navegação entre páginas é
// `<nav>` + lista de links com `aria-current="page"`, não
// `role="tablist"/"tab"/"tabpanel"` (que descreve painéis trocados na mesma
// tela). As setas ←/→ saíram com isso — existiam por causa do padrão de
// abas; entre links, quem anda é o Tab.
//
// NOTA PRA QUEM FOR TESTAR: os links agora respondem a `getByRole("link")`.
// O aviso antigo ("o menu usa role=tab, link acha zero") não vale mais.

const COOKIE_MENU = "menu-lateral";

const ROLE_LABEL: Record<"gerente" | "gestao", string> = {
  gerente: "Gerente",
  gestao: "Gestão",
};

// O estado inicial vem do servidor (cookie lido em app/layout.tsx) em vez de
// localStorage lido num efeito: assim o HTML do servidor e o do cliente já
// nascem iguais (sem descasamento de hidratação) e sem `setState` dentro de
// efeito, que é a regra de lint (`react-hooks/set-state-in-effect`) em que
// este projeto já tropeçou antes.
function guardarPreferencia(aberto: boolean) {
  try {
    document.cookie = `${COOKIE_MENU}=${aberto ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // Cookie bloqueado só custa a preferência entre recarregamentos; o menu
    // continua abrindo e fechando normalmente nesta sessão.
  }
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

function IconeMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function IconeSair() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2" />
      <path d="M10 12h10M17 9l3 3-3 3" />
    </svg>
  );
}

export function AppNav({
  role,
  nome,
  respostasNaoVistas,
  menuAberto,
  children,
}: {
  role: "gerente" | "gestao";
  nome: string;
  respostasNaoVistas: number;
  /** Preferência de menu aberto/fechado, lida do cookie no servidor. */
  menuAberto: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const links = NAV_LINKS[role];
  const [aberto, setAberto] = useState(menuAberto);

  // Sino de respostas do cliente (0036) — Realtime em `chamado_respostas`.
  // Qualquer INSERT/UPDATE (a sync grava, o gerente marca como visto) refaz o
  // fetch do layout, que recalcula o contador.
  useRealtimeRefresh("app-nav-respostas", [{ tabela: "chamado_respostas" }]);

  function alternarMenu() {
    setAberto((atual) => {
      guardarPreferencia(!atual);
      return !atual;
    });
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className={styles.shellOuter}>
      <div className={`${styles.app} ${aberto ? styles.aberto : styles.fechado}`}>
        <aside className={styles.sidebar}>
          {/* Cabeçalho: marca + gatilho. Recolhido sobra só o gatilho,
              centralizado na calha — o botão não fica boiando num vazio. */}
          <div className={styles.marca}>
            <span className={styles.marcaLogo} aria-hidden="true">
              <Image src="/logo-igedes.png" alt="" width={26} height={26} />
            </span>
            {/* O perfil (Gerente/Gestão) NÃO se repete aqui — ele já aparece
                ao lado do nome, no rodapé, que é onde tem a ver com quem
                está logado. */}
            <span className={styles.marcaNome}>Rota Inteligente</span>
            <button
              type="button"
              onClick={alternarMenu}
              aria-expanded={aberto}
              aria-label={aberto ? "Recolher o menu" : "Expandir o menu"}
              title={aberto ? "Recolher o menu" : "Expandir o menu"}
              className={styles.toggle}
            >
              <span className={styles.icon} aria-hidden="true">
                <IconeMenu />
              </span>
            </button>
          </div>

          <nav className={styles.nav} aria-label="Navegação principal">
            <ul className={styles.lista}>
              {links.map((link) => {
                const atual = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      // `aria-current="page"` é o que anuncia "você está
                      // aqui" — cor sozinha nunca é sinal suficiente (mesma
                      // regra do CLAUDE.md pros badges).
                      aria-current={atual ? "page" : undefined}
                      className={`${styles.item} ${atual ? styles.itemAtivo : ""}`}
                      title={aberto ? undefined : link.label}
                    >
                      <span className={styles.icon} aria-hidden="true">
                        {NavIcons[link.icon]}
                      </span>
                      <span className={styles.rotulo}>{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className={styles.rodape}>
            {respostasNaoVistas > 0 && (
              <Link
                href="/chamados"
                className={`${styles.item} ${styles.sino}`}
                title={aberto ? undefined : `${respostasNaoVistas} chamado(s) com resposta nova`}
              >
                <span className={styles.icon} aria-hidden="true">
                  🔔
                </span>
                <span className={styles.rotulo}>Respostas novas</span>
                <span className={styles.badge} aria-hidden="true">
                  {respostasNaoVistas}
                </span>
                <span className="sr-only">
                  {respostasNaoVistas} chamado(s) com resposta nova do cliente
                </span>
              </Link>
            )}

            <div className={styles.usuario}>
              <span className={styles.avatar} aria-hidden="true">
                {iniciais(nome)}
              </span>
              <span className={styles.usuarioTexto}>
                <span className={styles.usuarioNome} title={nome}>
                  {nome}
                </span>
                <span className={styles.usuarioPapel}>{ROLE_LABEL[role]}</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sair da conta"
                title="Sair"
                className={styles.sair}
              >
                <span className={styles.icon} aria-hidden="true">
                  <IconeSair />
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* Só existe em tela estreita, onde o menu aberto passa a cobrir o
            conteúdo em vez de empurrá-lo. É um <button> de verdade (não uma
            div com onClick) pra continuar alcançável e anunciado. */}
        <button
          type="button"
          className={styles.backdrop}
          onClick={alternarMenu}
          aria-label="Fechar o menu"
          tabIndex={aberto ? 0 : -1}
        />

        <div className={styles.paper}>
          <main className="flex min-h-full min-w-0 flex-col">{children}</main>
        </div>
      </div>
    </div>
  );
}
