import type { NavIcons } from "./nav-icons";

export type NavLink = { href: string; label: string; icon: keyof typeof NavIcons };
export type NavGrupo = { titulo: string; links: NavLink[] };

// Menu agrupado (18/09/2026, nova identidade visual). Antes eram 11 links
// soltos numa lista só; agora cada grupo diz em que momento do fluxo o
// gerente está — Operação (o dia a dia da rota), Fechamento (o que espera
// decisão dele), Relatórios e Cadastros. Os mesmos links de sempre, só
// ganharam contexto; `icon` casa 1:1 com `NavIcons`.
export const NAV_GRUPOS: Record<"gerente" | "gestao", NavGrupo[]> = {
  gerente: [
    {
      titulo: "Operação",
      links: [
        { href: "/dashboard", label: "Dashboard", icon: "grid" },
        { href: "/urgencias", label: "Urgências", icon: "siren" },
        { href: "/rotas/montar", label: "Montar rota", icon: "route" },
        { href: "/rotas/confirmadas", label: "Rotas confirmadas", icon: "check" },
      ],
    },
    {
      titulo: "Fechamento",
      links: [
        { href: "/validacao", label: "Validação", icon: "clip" },
        { href: "/pendencias", label: "Pendências", icon: "alert" },
      ],
    },
    {
      titulo: "Relatórios",
      links: [
        { href: "/relatorios/mensal-csm", label: "Relatório mensal", icon: "report" },
        { href: "/relatorios/rt", label: "Relatório de RT", icon: "home" },
      ],
    },
    {
      titulo: "Cadastros",
      links: [
        { href: "/equipes", label: "Equipes", icon: "users" },
        { href: "/chamados", label: "Chamados", icon: "head" },
        { href: "/zonas", label: "Zonas e regiões", icon: "map" },
      ],
    },
  ],
  gestao: [
    {
      titulo: "Acompanhamento",
      links: [
        { href: "/painel", label: "Painel", icon: "grid" },
        { href: "/urgencias", label: "Urgências", icon: "siren" },
        { href: "/relatorio", label: "Relatório diário", icon: "clip" },
      ],
    },
    {
      titulo: "Cadastros",
      links: [
        { href: "/rts", label: "RTs", icon: "home" },
        { href: "/chamados", label: "Chamados", icon: "head" },
        { href: "/zonas", label: "Zonas e regiões", icon: "map" },
      ],
    },
  ],
};

// Lista plana — pra quem só precisa saber "quais rotas existem pra este
// perfil" (testes, redirecionamentos), sem se importar com o agrupamento.
export const NAV_LINKS: Record<"gerente" | "gestao", NavLink[]> = {
  gerente: NAV_GRUPOS.gerente.flatMap((g) => g.links),
  gestao: NAV_GRUPOS.gestao.flatMap((g) => g.links),
};
