"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./logout-button";
import { NAV_LINKS } from "./nav-links";
import { FOCUS_RING } from "@/lib/ui/styles";

const ROLE_LABEL: Record<"gerente" | "gestao", string> = {
  gerente: "Gerente",
  gestao: "Gestão",
};

// Menu persistente pra gerente/gestão — antes disso, toda navegação
// passava pelo hub em "/" e voltar pra outra página exigia a seta do
// navegador. Fica de fora do perfil técnico de propósito (interface
// mobile-first, "poucos toques por tela" — só login + serviços do dia).
export function Sidebar({ role, nome }: { role: "gerente" | "gestao"; nome: string }) {
  const pathname = usePathname();
  const links = NAV_LINKS[role];

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-4 py-5">
        <Link href="/" className={`block ${FOCUS_RING}`}>
          <p className="text-sm font-semibold text-text-primary">Gestão SRT</p>
        </Link>
        <p className="mt-0.5 text-xs text-text-tertiary">perfil {ROLE_LABEL[role]}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {links.map((link) => {
            const ativo = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`block rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors ${FOCUS_RING} ${
                    ativo
                      ? "bg-accent/10 font-medium text-accent"
                      : "text-text-secondary hover:bg-surface-input hover:text-text-primary"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="mb-2 truncate text-xs text-text-tertiary" title={nome}>
          {nome}
        </p>
        <LogoutButton />
      </div>
    </aside>
  );
}
