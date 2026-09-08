// Ícones do menu-pasta (26/08/2026), path data copiado literalmente do
// arquivo de referência `menu-pasta-ospower.html` (objeto `I` do <script>).
// `home` é o único novo (RTs, perfil gestão) — não existe no arquivo de
// referência porque a demo só cobria os 8 links do gerente; desenhado no
// mesmo estilo (viewBox 24x24, traço 1.6, cantos arredondados) pra não
// destoar dos demais.
import type { ReactNode } from "react";

const stroke = {
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const NavIcons = {
  grid: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  route: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="6" cy="19" r="2.4" />
      <circle cx="18" cy="5" r="2.4" />
      <path d="M15.6 5H9a3.5 3.5 0 0 0 0 7h6a3.5 3.5 0 0 1 0 7H8.4" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.4 12 2.6 2.6L15.8 9" />
    </svg>
  ),
  clip: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <rect x="5" y="4" width="14" height="17" rx="2.5" />
      <path d="M9.5 4V3.2A1.2 1.2 0 0 1 10.7 2h2.6a1.2 1.2 0 0 1 1.2 1.2V4" />
      <path d="m9.5 13.5 2 2 3.5-4" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.3h.01" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.6a3.2 3.2 0 0 1 0 6.3M17.6 20a5.6 5.6 0 0 0-2.3-4.5" />
    </svg>
  ),
  head: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4.5 13v-1a7.5 7.5 0 0 1 15 0v1" />
      <rect x="2.5" y="12.6" width="4" height="6" rx="1.6" />
      <rect x="17.5" y="12.6" width="4" height="6" rx="1.6" />
      <path d="M20 18.6v.6a2.4 2.4 0 0 1-2.4 2.4H13.5" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="m9 4 6 2 5-2v14l-5 2-6-2-5 2V6z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      <path d="M10 20v-5h4v5" />
    </svg>
  ),
  // Novo (Central de Urgências, 04/09/2026) — não existe no arquivo de
  // referência (mesma situação de `home`). Siren/luz de emergência, no
  // mesmo estilo (viewBox 24x24, traço 1.6) — distinto de `alert`
  // (círculo+exclamação, já usado em Pendências) e `clip` (Validação).
  siren: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M7 14a5 5 0 0 1 10 0v3H7z" />
      <rect x="4.5" y="17" width="15" height="3" rx="1.3" />
      <path d="M12 8V5.5M8.6 9.4 7 7.8M15.4 9.4 17 7.8" />
    </svg>
  ),
  // Novo (Relatório mensal CSM, 08/09/2026) — folha com dobra + linhas de
  // texto. Distinto de `clip` (prancheta, Validação) e `head` (Chamados).
  report: (
    <svg viewBox="0 0 24 24" {...stroke}>
      <path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  ),
} satisfies Record<string, ReactNode>;
