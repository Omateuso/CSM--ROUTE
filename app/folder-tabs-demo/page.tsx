"use client";

import { FolderTabs, type Tab } from "@/lib/ui/folder-tabs";

// Ícones inline (sem lucide-react — não está instalado no projeto, ver
// CLAUDE.md/decisões de dependência) — linha fina, 16x16, currentColor.
function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function IconPill() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
      <path d="M9.5 9.5l5 5" />
    </svg>
  );
}
function IconFlask() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v6l-6 10a1.5 1.5 0 0 0 1.3 2.2h13.4A1.5 1.5 0 0 0 20 19L14 9V3" />
      <path d="M7.5 15h9" />
    </svg>
  );
}
function IconAsterisk() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9" />
    </svg>
  );
}
function IconGenetics() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 4c0 6 12 10 12 16M18 4c0 6-12 10-12 16M5 9h14M5 15h14" />
    </svg>
  );
}

function Secao({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{titulo}</h2>
      <p style={{ margin: "6px 0 0", color: "#6b6560", fontSize: 13.5 }}>{texto}</p>
    </>
  );
}

const TABS: Tab[] = [
  {
    id: "treatment",
    label: "Treatment Dynamics",
    icon: <IconSearch />,
    content: <Secao titulo="Treatment Dynamics" texto="Como o tratamento evoluiu ao longo do tempo." />,
  },
  {
    id: "visits",
    label: "Visits",
    icon: <IconCalendar />,
    content: <Secao titulo="Visits" texto="Histórico de consultas e atendimentos registrados." />,
  },
  {
    id: "medications",
    label: "Medications",
    icon: <IconPill />,
    content: <Secao titulo="Medications" texto="Medicações em uso e histórico de prescrições." />,
  },
  {
    id: "labs",
    label: "Labs",
    icon: <IconFlask />,
    content: <Secao titulo="Labs" texto="Resultados de exames laboratoriais recentes." />,
  },
  {
    id: "allergies",
    label: "Allergies",
    icon: <IconAsterisk />,
    content: <Secao titulo="Allergies" texto="Alergias e reações conhecidas." />,
  },
  {
    id: "genetics",
    label: "Genetics",
    icon: <IconGenetics />,
    content: <Secao titulo="Genetics" texto="Histórico e predisposições genéticas relevantes." />,
  },
];

// Página de demonstração isolada do FolderTabs (lib/ui/folder-tabs) — não
// faz parte do fluxo real do CSM ROUTE, só existe pra validar visualmente
// o componente. Overlay fixo cobrindo a tela inteira de propósito: se
// alguém acessar logado como gerente/gestão, o menu real (app/app-nav.tsx)
// ainda renderiza por trás (é global no layout raiz) — o overlay evita
// misturar as duas navegações na mesma visão.
export default function FolderTabsDemoPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#f2f1ee",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <div style={{ width: "100%", maxWidth: 1040 }}>
        <FolderTabs tabs={TABS} defaultTabId="treatment" onClose={() => window.history.back()} />
      </div>
    </div>
  );
}
