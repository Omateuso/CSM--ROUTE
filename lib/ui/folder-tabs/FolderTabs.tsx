"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import styles from "./FolderTabs.module.css";

export type Tab = { id: string; label: string; icon: ReactNode; content: ReactNode };

export type FolderTabsProps = {
  tabs: Tab[];
  defaultTabId?: string;
  /** Modo controlado, opcional — se presente, o componente não guarda estado próprio. */
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  onClose?: () => void;
  className?: string;
};

const TRANSITION_MS = 420;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Componente de navegação "pasta de arquivo" (spec fechada pelo usuário,
// 26/08/2026) — a aba selecionada não é uma pílula, ela vira a lingueta da
// pasta (encostada no corpo do painel); as demais ficam como pílulas claras
// à direita, sempre na ordem original de `tabs` (nunca embaralham). Ao
// trocar de aba: a lingueta anima largura (medida via elemento fantasma
// oculto, `.ghost`), o rótulo cruza em fade, e as pílulas vizinhas
// deslizam via FLIP (First-Last-Invert-Play, Web Animations API) — sem
// biblioteca de animação nova, só CSS + `Element.animate`.
export function FolderTabs({
  tabs,
  defaultTabId,
  activeTabId,
  onTabChange,
  onClose,
  className,
}: FolderTabsProps) {
  const [uncontrolledId, setUncontrolledId] = useState(defaultTabId ?? tabs[0]?.id);
  const activeId = activeTabId ?? uncontrolledId;
  const activeIndex = tabs.findIndex((t) => t.id === activeId);
  const activeTab = tabs[activeIndex] ?? tabs[0];
  const inactiveTabs = useMemo(() => tabs.filter((t) => t.id !== activeTab?.id), [tabs, activeTab?.id]);

  const elementRefs = useRef(new Map<string, HTMLButtonElement>());
  const registerElement = useCallback(
    (id: string) => (el: HTMLButtonElement | null) => {
      if (el) elementRefs.current.set(id, el);
      else elementRefs.current.delete(id);
    },
    [],
  );

  const prevPillRectsRef = useRef(new Map<string, DOMRect>());
  const prevPillIdsRef = useRef(new Set<string>());

  function snapshotPillRects() {
    const snapshot = new Map<string, DOMRect>();
    for (const tab of inactiveTabs) {
      const el = elementRefs.current.get(tab.id);
      if (el) snapshot.set(tab.id, el.getBoundingClientRect());
    }
    prevPillRectsRef.current = snapshot;
    prevPillIdsRef.current = new Set(snapshot.keys());
  }

  const selectTab = useCallback(
    (id: string) => {
      if (id === activeId) return;
      snapshotPillRects(); // "First" do FLIP — antes do estado mudar
      if (activeTabId === undefined) setUncontrolledId(id);
      onTabChange?.(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshotPillRects lê refs, não precisa entrar nas deps
    [activeId, activeTabId, onTabChange],
  );

  // "Last + Invert + Play" — roda depois que a lista de pílulas já
  // reconciliou no DOM com a nova aba ativa.
  useLayoutEffect(() => {
    const reduced = prefersReducedMotion();
    for (const tab of inactiveTabs) {
      const el = elementRefs.current.get(tab.id);
      if (!el) continue;
      const novo = el.getBoundingClientRect();
      const existiaAntes = prevPillIdsRef.current.has(tab.id);
      if (reduced) continue;
      if (existiaAntes) {
        const antigo = prevPillRectsRef.current.get(tab.id);
        if (!antigo) continue;
        const dx = antigo.left - novo.left;
        if (Math.abs(dx) > 0.5) {
          el.animate(
            [{ transform: `translateX(${dx}px)` }, { transform: "none" }],
            { duration: TRANSITION_MS, easing: "cubic-bezier(.2,.8,.2,1)" },
          );
        }
      } else {
        // pílula que acabou de voltar (era a lingueta até agora)
        el.animate(
          [
            { opacity: 0, transform: "scale(.85)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 300, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só precisa rodar quando a aba ativa muda
  }, [activeId]);

  // Mede a largura "natural" do conteúdo da lingueta (ícone + rótulo) via
  // elemento fantasma invisível com o MESMO padding/fonte/gap — se
  // divergir, a curva côncava (.joint) fica desalinhada com a borda.
  const ghostRef = useRef<HTMLDivElement>(null);
  const [tabWidth, setTabWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (ghostRef.current) {
      setTabWidth(ghostRef.current.getBoundingClientRect().width);
    }
  }, [activeTab?.id]);

  useEffect(() => {
    function recalcular() {
      if (ghostRef.current) setTabWidth(ghostRef.current.getBoundingClientRect().width);
    }
    window.addEventListener("resize", recalcular);
    return () => window.removeEventListener("resize", recalcular);
  }, []);

  function handleKeyDownTablist(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    if (tabs.length === 0) return;
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const currentIndex = activeIndex === -1 ? 0 : activeIndex;
    const nextIndex = (currentIndex + delta + tabs.length) % tabs.length;
    const nextId = tabs[nextIndex]?.id;
    if (!nextId) return;
    selectTab(nextId);
    requestAnimationFrame(() => elementRefs.current.get(nextId)?.focus());
  }

  if (!activeTab) return null;

  const tabLeft = 14;
  const jointLeft = tabWidth != null ? tabLeft + tabWidth : undefined;

  return (
    <div className={`${styles.shell} ${className ?? ""}`}>
      {/* Fantasma de medição — nunca visível, só existe pra dar a largura
          "natural" do conteúdo da aba ativa antes de animar até ela. */}
      <div ref={ghostRef} className={`${styles.tab} ${styles.ghost}`} aria-hidden="true">
        <span className={styles.tabIcon}>{activeTab.icon}</span>
        <span className={styles.tabLabelText}>{activeTab.label}</span>
      </div>

      <div className={styles.body}>
        <div key={activeTab.id} className={styles.panelContent} role="tabpanel" id={`panel-${activeTab.id}`} aria-labelledby={`tab-${activeTab.id}`}>
          {activeTab.content}
        </div>
      </div>

      <div className={styles.tablist} role="tablist" aria-label="Navegação por abas" onKeyDown={handleKeyDownTablist}>
        <button
          ref={registerElement(activeTab.id)}
          id={`tab-${activeTab.id}`}
          role="tab"
          type="button"
          aria-selected="true"
          aria-controls={`panel-${activeTab.id}`}
          tabIndex={0}
          className={styles.tab}
          style={tabWidth != null ? { width: `${tabWidth}px` } : undefined}
        >
          <span className={styles.tabIcon}>{activeTab.icon}</span>
          <span key={activeTab.id} className={styles.tabLabelText}>
            {activeTab.label}
          </span>
        </button>

        <span
          aria-hidden="true"
          className={styles.joint}
          style={jointLeft != null ? { left: `${jointLeft}px` } : undefined}
        />

        <div className={styles.pillsRow}>
          {inactiveTabs.map((tab) => (
            <button
              key={tab.id}
              ref={registerElement(tab.id)}
              id={`tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected="false"
              aria-controls={`panel-${tab.id}`}
              tabIndex={-1}
              className={styles.pill}
              onClick={() => selectTab(tab.id)}
            >
              <span className={styles.pillIcon}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className={styles.closeButton} onClick={() => onClose?.()} aria-label="Fechar">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
