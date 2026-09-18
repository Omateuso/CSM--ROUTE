// Primitivo único pro padrão "dot + texto" que existia reimplementado em 6
// lugares (PrioridadeBadge, SlaBadge, StatusChamadoBadge, StatusServicoBadge,
// status de rota/equipe/RT) — auditoria de design, 23/08/2026. Cada badge
// de domínio continua existindo (mantém a API pública, os call sites não
// mudam) — só passa a ser um wrapper fino sobre este componente, mapeando
// o valor de domínio pras classes certas.
//
// De propósito um primitivo "burro": recebe as classes Tailwind já prontas
// (`dotClassName`/`textClassName`/`pillClassName`) em vez de tentar
// adivinhar uma paleta — cada badge sabe suas próprias cores (prioridade,
// SLA, status), e são vocabulários diferentes que não deveriam ficar
// acoplados num "tone" único.
//
// `pillClassName` (nova identidade visual, 18/09/2026): quando presente, o
// badge vira uma pílula com fundo tingido — reservado às duas camadas que
// precisam gritar numa lista densa (prioridade e SLA). Os demais status
// continuam "dot + texto", mais quietos.
export function StatusDot({
  label,
  dotClassName,
  textClassName = "text-text-secondary",
  pillClassName,
}: {
  label: string;
  dotClassName: string;
  textClassName?: string;
  pillClassName?: string;
}) {
  if (pillClassName) {
    return (
      <span
        className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full pl-2 pr-2.5 text-xs font-medium ${pillClassName} ${textClassName}`}
      >
        <span className={`h-[7px] w-[7px] rounded-full ${dotClassName}`} aria-hidden="true" />
        {label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${textClassName}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClassName}`} aria-hidden="true" />
      {label}
    </span>
  );
}
