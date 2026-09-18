import Link from "next/link";
import { SECONDARY_BUTTON } from "@/lib/ui/styles";

// Navega pra /pendencias (página própria desde 22/08/2026 — antes era um
// modal aqui mesmo). Nova identidade (18/09/2026): era uma pílula rosa
// fornecida pelo usuário — a única cor fora da paleta em toda a tela, e
// competia com o botão "Validar", que é a ação principal daqui. Agora é
// um botão secundário: visível, mas não grita.
export function PendenciasLinkButton() {
  return (
    <Link href="/pendencias" className={SECONDARY_BUTTON}>
      <span>Pendências</span>
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m9 6 6 6-6 6" />
      </svg>
    </Link>
  );
}
