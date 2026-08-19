export type NavLink = { href: string; label: string };

// Mesmos links que existiam no hub antigo (app/page.tsx antes do menu
// lateral) — só mudou onde aparecem, não quais existem.
export const NAV_LINKS: Record<"gerente" | "gestao", NavLink[]> = {
  gerente: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/rotas/montar", label: "Montar rota" },
    { href: "/rotas/confirmadas", label: "Rotas confirmadas" },
    { href: "/validacao", label: "Validação" },
    { href: "/equipes", label: "Equipes" },
    { href: "/mapa", label: "Mapa" },
    { href: "/chamados", label: "Chamados" },
    { href: "/zonas", label: "Zonas e regiões" },
  ],
  gestao: [
    { href: "/painel", label: "Painel" },
    { href: "/relatorio", label: "Relatório diário" },
    { href: "/rts", label: "RTs" },
    { href: "/chamados", label: "Chamados" },
    { href: "/zonas", label: "Zonas e regiões" },
  ],
};
