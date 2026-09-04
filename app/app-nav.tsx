"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useId,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NAV_LINKS, type NavLink } from "./nav-links";
import { NavIcons } from "./nav-icons";
import styles from "./app-nav.module.css";

// Port do menu-pasta (26/08/2026) — porte literal do arquivo de referência
// aprovado pelo usuário (menu-pasta-ospower.html, ver prompt v2: "isso é
// um port, não um redesign"). Substitui de vez a pill bar/dock flutuante
// de 24-25/08 — a aba ativa deixa de ser uma pílula pintada e vira uma
// pasta (lingueta + corpo), com o CONTEÚDO DA PÁGINA sendo o corpo dela
// (por isso o componente agora recebe `children` e envolve a página
// inteira, não só a barra de navegação).
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function pillContent(link: NavLink) {
  return (
    <>
      <span className={styles.icon} aria-hidden="true">
        {NavIcons[link.icon]}
      </span>
      <span>{link.label}</span>
    </>
  );
}

export function AppNav({
  role,
  nome,
  children,
}: {
  role: "gerente" | "gestao";
  nome: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const links = NAV_LINKS[role];
  // Rota atual sem link no menu (ex.: /mapa, que saiu da navegação em
  // 25/08 mas a rota continua existindo) — degrada bem: nenhuma pílula
  // vira pasta, todas ficam na fileira normal, `.paper` só não ganha o
  // recorte da lingueta.
  const ativo = links.find((l) => l.href === pathname) ?? null;

  const tabId = useId();

  const [tabWidth, setTabWidth] = useState<number | undefined>(undefined);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const tabInnerRef = useRef<HTMLSpanElement>(null);
  const pillRefs = useRef(new Map<string, HTMLAnchorElement>());
  const prevRectsRef = useRef(new Map<string, DOMRect>());
  const mountedRef = useRef(false);
  const pendingFocusRef = useRef(false);

  const registerPill = useCallback(
    (href: string) => (el: HTMLAnchorElement | null) => {
      if (el) pillRefs.current.set(href, el);
      else pillRefs.current.delete(href);
    },
    [],
  );

  // Mede a lingueta (elemento fantasma, mesmo padding/fonte — não dá pra
  // saber a largura de "Rotas confirmadas" sem medir de verdade) e roda o
  // FLIP das pílulas: compara a posição de cada uma agora com a posição
  // guardada na renderização anterior (guardada no fim deste mesmo efeito,
  // pra servir de "antes" na próxima troca). Sem "antes" no primeiro
  // carregamento — pulado de propósito, mesmo comportamento do arquivo
  // original, que só anima a partir do primeiro clique.
  useLayoutEffect(() => {
    if (ghostRef.current) {
      setTabWidth(Math.ceil(ghostRef.current.getBoundingClientRect().width));
    }

    const reduced = prefersReducedMotion();

    if (!reduced && tabInnerRef.current) {
      tabInnerRef.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
    }

    const newRects = new Map<string, DOMRect>();
    pillRefs.current.forEach((el, href) => newRects.set(href, el.getBoundingClientRect()));

    if (mountedRef.current && !reduced) {
      newRects.forEach((rect, href) => {
        const el = pillRefs.current.get(href);
        if (!el) return;
        const prev = prevRectsRef.current.get(href);
        if (prev) {
          const dx = prev.left - rect.left;
          if (Math.abs(dx) > 0.5) {
            el.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], {
              duration: 420,
              easing: "cubic-bezier(.2,.8,.2,1)",
            });
          }
        } else {
          el.animate(
            [
              { opacity: 0, transform: "scale(.85)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: 300, easing: "ease-out" },
          );
        }
      });
    }

    prevRectsRef.current = newRects;
    mountedRef.current = true;

    if (pendingFocusRef.current) {
      pendingFocusRef.current = false;
      tabRef.current?.focus();
    }
  }, [pathname]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Setas ←/→ trocam de aba (mesmo padrão do arquivo) — aqui "trocar de
  // aba" é navegação de verdade (router.push), não troca de painel em
  // memória. Handler fica só nos elementos da pasta (tab + pílulas), nunca
  // em document — arquivo original prende no document, mas isso sequestraria
  // as setas em qualquer input/select/mapa do resto do app.
  function handleTabKeyDown(event: KeyboardEvent) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const currentIndex = ativo ? links.findIndex((l) => l.href === ativo.href) : -1;
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const base = currentIndex >= 0 ? currentIndex : 0;
    const next = links[(base + delta + links.length) % links.length];
    if (!next || next.href === pathname) return;
    pendingFocusRef.current = true;
    router.push(next.href);
  }

  const jointLeft = (tabWidth ?? 0) + 14; // --inset: 14px
  // Onde as pílulas podem começar: logo depois da lingueta (medida de
  // verdade, não um número fixo — ver comentário em app-nav.module.css
  // sobre por que o `max-width` fixo do arquivo original quebrava no
  // celular).
  const tabLeft = ativo ? jointLeft + 12 : 14;

  return (
    <div className={styles.shellOuter}>
      <div className={styles.app} style={{ "--tab-left": `${tabLeft}px` } as CSSProperties}>
        <div className={styles.topright}>
          <div className={styles.pills} role="tablist" aria-label="Navegação" aria-owns={ativo ? tabId : undefined}>
            {links
              .filter((link) => link.href !== ativo?.href)
              .map((link) => (
                <Link
                  key={link.href}
                  ref={registerPill(link.href)}
                  href={link.href}
                  role="tab"
                  aria-selected="false"
                  className={styles.pill}
                  onKeyDown={handleTabKeyDown}
                >
                  {pillContent(link)}
                </Link>
              ))}
          </div>
          <div className={styles.user} aria-label={nome}>
            <button type="button" onClick={handleLogout} className={styles.logout}>
              Sair
            </button>
          </div>
        </div>

        {ativo && (
          <>
            <div
              ref={tabRef}
              id={tabId}
              role="tab"
              aria-selected="true"
              tabIndex={0}
              onKeyDown={handleTabKeyDown}
              className={styles.tab}
              style={{ width: tabWidth }}
            >
              <span ref={tabInnerRef} className={styles.tabInner}>
                <span className={styles.icon} aria-hidden="true">
                  {NavIcons[ativo.icon]}
                </span>
                <span>{ativo.label}</span>
              </span>
            </div>
            <div className={styles.joint} style={{ left: jointLeft }} />
          </>
        )}

        <div className={styles.paper} role="tabpanel" aria-labelledby={ativo ? tabId : undefined}>
          <main className="flex min-h-full min-w-0 flex-col">{children}</main>
        </div>

        <span ref={ghostRef} className={styles.ghost} aria-hidden="true">
          {ativo ? pillContent(ativo) : null}
        </span>
      </div>
    </div>
  );
}
