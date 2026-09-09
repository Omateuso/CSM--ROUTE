import type { NavIcons } from "./nav-icons";

export type NavLink = { href: string; label: string; icon: keyof typeof NavIcons };

// Mesmos links que existiam no hub antigo (app/page.tsx antes do menu
// lateral) — só mudou onde aparecem, não quais existem. `icon` casa 1:1
// com o objeto `I` do arquivo de referência `menu-pasta-ospower.html`
// (26/08/2026) pros 8 links do gerente; os da gestão que não existiam na
// referência (Painel, Relatório diário, RTs) ganharam o ícone mais próximo
// em significado, sem repetir ícone dentro da mesma lista.
export const NAV_LINKS: Record<"gerente" | "gestao", NavLink[]> = {
  gerente: [
    { href: "/dashboard", label: "Dashboard", icon: "grid" },
    { href: "/urgencias", label: "Urgências", icon: "siren" },
    { href: "/rotas/montar", label: "Montar rota", icon: "route" },
    { href: "/rotas/confirmadas", label: "Rotas confirmadas", icon: "check" },
    { href: "/rotas/hoje", label: "Rota do dia", icon: "pin" },
    { href: "/validacao", label: "Validação", icon: "clip" },
    { href: "/pendencias", label: "Pendências", icon: "alert" },
    { href: "/relatorios/mensal-csm", label: "Relatório mensal", icon: "report" },
    { href: "/equipes", label: "Equipes", icon: "users" },
    { href: "/chamados", label: "Chamados", icon: "head" },
    { href: "/zonas", label: "Zonas e regiões", icon: "map" },
  ],
  gestao: [
    { href: "/painel", label: "Painel", icon: "grid" },
    { href: "/rotas/hoje", label: "Rota do dia", icon: "pin" },
    { href: "/urgencias", label: "Urgências", icon: "siren" },
    { href: "/relatorio", label: "Relatório diário", icon: "clip" },
    { href: "/rts", label: "RTs", icon: "home" },
    { href: "/chamados", label: "Chamados", icon: "head" },
    { href: "/zonas", label: "Zonas e regiões", icon: "map" },
  ],
};
