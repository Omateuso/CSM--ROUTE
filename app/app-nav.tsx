"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeRefresh } from "@/lib/realtime/use-realtime";
import { NAV_GRUPOS } from "./nav-links";
import { NavIcons } from "./nav-icons";
import { ThemeToggle, type Tema } from "@/lib/ui/theme-toggle";
import { BuscaRapida } from "@/lib/ui/busca-rapida";
import styles from "./app-nav.module.css";

// Menu lateral (nova identidade visual, 18/09/2026) — mesma mecânica do
// menu retrátil de 10/09 (todos os links sempre renderizados, na mesma
// ordem; só o ativo muda de aparência no lugar), com três mudanças:
//
// 1. Visual "operacional claro": o menu tem a MESMA cor do fundo da página,
//    separado só por uma borda fina. A moldura escura arredondada saiu —
//    ela fazia menu e conteúdo parecerem dois mundos (e pesava a tela).
// 2. Links agrupados por momento do fluxo (Operação / Fechamento / ...),
//    ver NAV_GRUPOS em nav-links.ts.
// 3. Celular: o menu NASCE FECHADO. Antes a preferência "aberto" do desktop
//    (cookie, padrão = aberto) também valia pra tela estreita, onde "aberto"
//    é um painel cobrindo o conteúdo — o primeiro toque de qualquer página
//    era sempre fechar o menu. Agora são dois estados independentes:
//    `aberto` (desktop, persistido em cookie) e `mobileAberto` (só nesta
//    sessão, sempre começa fechado, fecha ao escolher um link).
//
// Semântica: `<nav>` + lista de links com `aria-current="page"`. Os links
// respondem a `getByRole("link")`.

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

function IconeFechar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function IconeBusca() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4-4" />
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
  tema,
  children,
}: {
  role: "gerente" | "gestao";
  nome: string;
  respostasNaoVistas: number;
  /** Preferência de menu aberto/fechado no desktop, lida do cookie no servidor. */
  menuAberto: boolean;
  /** Tema salvo (cookie `tema`); `null` = segue o sistema. */
  tema: Tema;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const grupos = NAV_GRUPOS[role];
  const [aberto, setAberto] = useState(menuAberto);
  const [mobileAberto, setMobileAberto] = useState(false);

  // Sino de respostas do cliente (0036) — Realtime em `chamado_respostas`.
  // Qualquer INSERT/UPDATE (a sync grava, o gerente marca como visto) refaz o
  // fetch do layout, que recalcula o contador.
  useRealtimeRefresh("app-nav-respostas", [{ tabela: "chamado_respostas" }]);

  function alternarDesktop() {
    setAberto((atual) => {
      guardarPreferencia(!atual);
      return !atual;
    });
  }

  function alternarMobile() {
    setMobileAberto((atual) => !atual);
  }

  // Escolher um link no celular fecha o painel — no desktop não faz nada
  // (o menu é fixo). Feito no clique, não num efeito de `pathname`, pra não
  // cair na regra `set-state-in-effect`.
  function fecharMobile() {
    if (mobileAberto) setMobileAberto(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div
      className={`${styles.app} ${aberto ? styles.aberto : styles.fechado} ${
        mobileAberto ? styles.mobileAberto : ""
      }`}
    >
      <aside className={styles.sidebar}>
        <div className={styles.marca}>
          <span className={styles.marcaLogo} aria-hidden="true">
            <Image src="/logo-igedes.png" alt="" width={28} height={28} />
          </span>
          <span className={styles.marcaTexto}>
            <span className={styles.marcaNome}>Rota Inteligente</span>
            <span className={styles.marcaSub}>CSM · Manutenção de RTs</span>
          </span>
          {/* Dois gatilhos, um por largura de tela (o CSS mostra só um):
              cada um anuncia o estado que controla de verdade. Decidir isso
              com matchMedia durante o render daria HTML diferente entre
              servidor e cliente. */}
          <button
            type="button"
            onClick={alternarDesktop}
            aria-expanded={aberto}
            aria-label={aberto ? "Recolher o menu" : "Expandir o menu"}
            title={aberto ? "Recolher o menu" : "Expandir o menu"}
            className={`${styles.toggle} ${styles.toggleDesktop}`}
          >
            <span className={styles.icon} aria-hidden="true">
              <IconeMenu />
            </span>
          </button>
          <button
            type="button"
            onClick={alternarMobile}
            aria-expanded={mobileAberto}
            aria-label={mobileAberto ? "Fechar o menu" : "Abrir o menu"}
            className={`${styles.toggle} ${styles.toggleMobile}`}
          >
            <span className={styles.icon} aria-hidden="true">
              {mobileAberto ? <IconeFechar /> : <IconeMenu />}
            </span>
          </button>
        </div>

        {/* Em tela estreita, este wrapper vira o painel que desce da barra
            do topo (nav + rodapé juntos) — em tela larga é `display:contents`. */}
        <div className={styles.menuFlutuante}>
          <BuscaRapida
            role={role}
            trigger={(abrir) => (
              <button
                type="button"
                onClick={abrir}
                className={`${styles.item} ${styles.busca}`}
                title={aberto ? undefined : "Buscar (Ctrl K)"}
                aria-keyshortcuts="Control+K"
              >
                <span className={styles.icon} aria-hidden="true">
                  <IconeBusca />
                </span>
                <span className={styles.rotulo}>Buscar</span>
                <kbd className={styles.kbd} aria-hidden="true">
                  Ctrl K
                </kbd>
              </button>
            )}
          />
          <nav className={styles.nav} aria-label="Navegação principal">
            {grupos.map((grupo) => (
              <div key={grupo.titulo} className={styles.grupo}>
                <p className={styles.grupoTitulo}>{grupo.titulo}</p>
                <ul className={styles.lista}>
                  {grupo.links.map((link) => {
                    const atual = pathname === link.href || pathname.startsWith(`${link.href}/`);
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={fecharMobile}
                          // `aria-current="page"` é o que anuncia "você está
                          // aqui" — cor sozinha nunca é sinal suficiente.
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
              </div>
            ))}
          </nav>

          <div className={styles.rodape}>
            {respostasNaoVistas > 0 && (
              <Link
                href="/chamados"
                onClick={fecharMobile}
                className={`${styles.item} ${styles.sino}`}
                title={aberto ? undefined : `${respostasNaoVistas} chamado(s) com resposta nova`}
              >
                <span className={styles.icon} aria-hidden="true">
                  {NavIcons.bell}
                </span>
                <span className={styles.rotulo}>Respostas novas</span>
                <span className={styles.badge} aria-hidden="true">
                  {respostasNaoVistas > 99 ? "99+" : respostasNaoVistas}
                </span>
                <span className="sr-only">
                  {respostasNaoVistas} chamado(s) com resposta nova do cliente
                </span>
              </Link>
            )}

            <ThemeToggle
              inicial={tema}
              className={`${styles.item} ${styles.tema}`}
              iconClassName={styles.icon}
              labelClassName={styles.rotulo}
            />

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
        </div>
      </aside>

      {/* Só existe em tela estreita, onde o menu aberto cobre o conteúdo em
          vez de empurrá-lo. É um <button> de verdade (não uma div com
          onClick) pra continuar alcançável e anunciado. */}
      <button
        type="button"
        className={styles.backdrop}
        onClick={fecharMobile}
        aria-label="Fechar o menu"
        tabIndex={mobileAberto ? 0 : -1}
      />

      <div className={styles.conteudo}>
        <main className="flex min-h-full min-w-0 flex-col">{children}</main>
      </div>
    </div>
  );
}
