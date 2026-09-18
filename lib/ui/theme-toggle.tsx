"use client";

import { useState } from "react";

// Alternador de tema (18/09/2026). Três estados, em ciclo: automático
// (segue o sistema) → claro → escuro → automático. A preferência vai num
// cookie (`tema`) lido em app/layout.tsx, que já manda `data-theme` no
// <html> desde o servidor — sem flash de tema errado no primeiro paint e
// sem `setState` em efeito. Estado inicial vem por prop pelo mesmo motivo.
//
// A troca em si é só `data-theme` no <html>: todos os tokens de
// app/globals.css respondem a isso. `data-theme-transition` liga por 250ms
// a transição de cor definida lá (desligada em prefers-reduced-motion).

export type Tema = "light" | "dark" | null;

const COOKIE = "tema";
const ORDEM: Tema[] = [null, "light", "dark"];

const ROTULO: Record<"auto" | "light" | "dark", string> = {
  auto: "Tema automático (segue o sistema)",
  light: "Tema claro",
  dark: "Tema escuro",
};

function aplicar(tema: Tema) {
  const html = document.documentElement;
  html.setAttribute("data-theme-transition", "");
  if (tema) html.dataset.theme = tema;
  else delete html.dataset.theme;
  try {
    document.cookie = tema
      ? `${COOKIE}=${tema}; path=/; max-age=31536000; samesite=lax`
      : `${COOKIE}=; path=/; max-age=0; samesite=lax`;
  } catch {
    // Sem cookie a escolha vale só nesta aba; nada quebra.
  }
  window.setTimeout(() => html.removeAttribute("data-theme-transition"), 300);
}

function IconeSol() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}
function IconeLua() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  );
}
function IconeAuto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ThemeToggle({
  inicial,
  className = "",
  iconClassName = "",
  labelClassName,
}: {
  /** Preferência salva (cookie), lida no servidor. `null` = automático. */
  inicial: Tema;
  className?: string;
  iconClassName?: string;
  /** Se informado, mostra o rótulo do estado ao lado do ícone (menu expandido). */
  labelClassName?: string;
}) {
  const [tema, setTema] = useState<Tema>(inicial);
  const chave = tema ?? "auto";
  const proximo = ORDEM[(ORDEM.indexOf(tema) + 1) % ORDEM.length];
  const rotuloProximo = ROTULO[proximo ?? "auto"];

  function ciclar() {
    setTema(proximo);
    aplicar(proximo);
  }

  return (
    <button
      type="button"
      onClick={ciclar}
      aria-label={`${ROTULO[chave]}. Trocar para: ${rotuloProximo.toLowerCase()}`}
      title={`Trocar para ${rotuloProximo.toLowerCase()}`}
      className={className}
    >
      <span className={iconClassName} aria-hidden="true">
        {chave === "light" ? <IconeSol /> : chave === "dark" ? <IconeLua /> : <IconeAuto />}
      </span>
      {labelClassName && (
        <span className={labelClassName}>
          {chave === "light" ? "Tema claro" : chave === "dark" ? "Tema escuro" : "Tema automático"}
        </span>
      )}
    </button>
  );
}
