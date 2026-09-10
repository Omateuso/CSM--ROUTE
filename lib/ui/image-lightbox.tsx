"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { FOCUS_RING } from "./styles";

// Miniatura que abre a imagem ampliada num overlay dentro da própria tela —
// sem link "abrir em nova aba" e sem botão de baixar (pedido do usuário,
// 10/09/2026: "expandir a imagem de anexo do chamado, remover a função de
// baixar").
//
// Usa a Popover API (`popover="manual"`): renderiza no top layer, então fica
// por cima do modal de detalhe do chamado (que é um <dialog>), e fechá-la
// NÃO fecha o <dialog> pai — diferente de um <dialog> aninhado, que no
// Chromium fecha os dois juntos. Esc é tratado manualmente (manual popover
// não faz light-dismiss).
export function LightboxImage({
  url,
  alt,
  legenda,
}: {
  url: string;
  alt: string;
  /** Texto pequeno acima da miniatura (ex.: "Da abertura"). */
  legenda?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pop = popRef.current;
    if (!pop) return;
    try {
      if (aberto && !pop.matches(":popover-open")) pop.showPopover();
      if (!aberto && pop.matches(":popover-open")) pop.hidePopover();
    } catch {
      // Popover API indisponível — o `[&:not(:popover-open)]:hidden` +
      // `flex` no className garante que ao menos não fique um overlay
      // travado na tela.
    }
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    // Esc fecha SÓ o lightbox: intercepta em captura no document, antes de
    // chegar ao onCancel do <dialog> de detalhe por baixo.
    function onEsc(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setAberto(false);
    }
    document.addEventListener("keydown", onEsc, true);
    return () => document.removeEventListener("keydown", onEsc, true);
  }, [aberto]);

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) setAberto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={`Ampliar imagem: ${alt}`}
        className={`flex flex-col items-start gap-1 ${FOCUS_RING}`}
      >
        {legenda && <span className="text-[11px] text-text-tertiary">{legenda}</span>}
        {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada de bucket privado */}
        <img
          src={url}
          alt={alt}
          className="h-24 w-24 rounded-[var(--radius-sm)] border border-border object-cover transition-opacity hover:opacity-80"
        />
      </button>

      <div
        ref={popRef}
        popover="manual"
        role="dialog"
        aria-modal="true"
        aria-label={alt}
        onClick={handleBackdropClick}
        className="fixed inset-0 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center border-0 bg-black/80 p-4 [&:not(:popover-open)]:hidden"
      >
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar imagem"
          className={`absolute top-4 right-4 rounded-full bg-black/60 px-3 py-1 text-lg leading-none text-white ${FOCUS_RING}`}
        >
          ✕
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada de bucket privado */}
        <img src={url} alt={alt} className="max-h-[90vh] max-w-[95vw] object-contain" />
      </div>
    </>
  );
}
