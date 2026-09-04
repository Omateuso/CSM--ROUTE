// Primitivo único pro padrão "dot + texto" que existia reimplementado em 6
// lugares (PrioridadeBadge, SlaBadge, StatusChamadoBadge, StatusServicoBadge,
// status de rota/equipe/RT) — auditoria de design, 23/08/2026. Cada badge
// de domínio continua existindo (mantém a API pública, os call sites não
// mudam) — só passa a ser um wrapper fino sobre este componente, mapeando
// o valor de domínio pras classes certas.
//
// De propósito um primitivo "burro": recebe as classes Tailwind já prontas
// (`dotClassName`/`textClassName`) em vez de tentar adivinhar uma paleta —
// cada badge sabe suas próprias cores (prioridade, SLA, status), e são
// vocabulários diferentes que não deveriam ficar acoplados num "tone" único.
export function StatusDot({
  label,
  dotClassName,
  textClassName = "text-text-secondary",
}: {
  label: string;
  dotClassName: string;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${textClassName}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClassName}`} aria-hidden="true" />
      {label}
    </span>
  );
}
