"use client";

import { useSyncExternalStore } from "react";

// Detecção de plataforma no cliente — só pra decidir QUAIS links de navegação
// oferecer (Apple Maps existe só no iPhone/iPad). Nunca usar pra mudar
// comportamento de dados. iPadOS 13+ se apresenta como Mac, por isso o
// segundo teste (Mac com toque).
export function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

const semAssinatura = () => () => {};

// Versão hook: no servidor (e no primeiro paint) devolve `false`, depois o
// valor real — sem `setState` em efeito (regra de lint do projeto) e sem
// descasamento de hidratação.
export function useEhIOS(): boolean {
  return useSyncExternalStore(semAssinatura, ehIOS, () => false);
}
