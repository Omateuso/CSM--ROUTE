"use client";

import { useEhIOS } from "@/lib/ui/plataforma";
import { FOCUS_RING } from "@/lib/ui/styles";

// Links "Como chegar" de um destino único (detalhe do serviço e grupo de RT
// do técnico). Google Maps sempre; Apple Maps só no iPhone/iPad (nunca cai
// na App Store, ao contrário do Google quando o app não está instalado);
// Waze opcional. Todos são <a href> de verdade — no iOS é isso que faz o
// universal link abrir o app em vez da versão web.
export function LinksNavegacao({
  google,
  apple,
  waze,
  compacto = false,
}: {
  google: string | null;
  apple: string | null;
  waze?: string | null;
  compacto?: boolean;
}) {
  const ios = useEhIOS();
  if (!google) return null;

  const principal = compacto
    ? `inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-accent bg-accent-tint px-2.5 py-1.5 text-xs font-semibold text-accent-on-tint transition-colors hover:bg-accent-tint-strong ${FOCUS_RING}`
    : `flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-accent bg-accent-tint px-4 py-2.5 text-sm font-semibold text-accent-on-tint transition-colors hover:bg-accent-tint-strong ${FOCUS_RING}`;
  const secundario = compacto
    ? `inline-flex items-center rounded-[var(--radius-sm)] border border-border-strong px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-input ${FOCUS_RING}`
    : `flex shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border-strong px-3 py-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-input ${FOCUS_RING}`;

  return (
    <div className={compacto ? "flex flex-wrap gap-1.5" : "mt-3 flex flex-wrap gap-2"}>
      <a href={google} target="_blank" rel="noopener noreferrer" className={principal}>
        <span aria-hidden="true">➤</span>
        {compacto ? "Como chegar" : "Como chegar (Google Maps)"}
      </a>
      {ios && apple && (
        <a href={apple} target="_blank" rel="noopener noreferrer" className={secundario} aria-label="Abrir no Apple Maps">
          Apple Maps
        </a>
      )}
      {waze && (
        <a href={waze} target="_blank" rel="noopener noreferrer" className={secundario} aria-label="Abrir no Waze">
          Waze
        </a>
      )}
    </div>
  );
}
