// Selo compartilhado pelos sinais de integridade operacional (auditoria de
// segurança, 21/08/2026) — localização não confere, OS reaproveitada,
// muitos reagendamentos, deslocamento suspeito etc. Mesmo padrão visual
// dot+texto que PrioridadeBadge/SlaBadge já usam, mas com tons próprios
// (não reaproveita as cores de prioridade/SLA — CLAUDE.md reserva essa
// paleta pra esses dois significados específicos; "alerta" usa o token
// `danger` e "positivo" usa `success`, ambos genéricos de feedback de UI,
// já usados em mensagens de erro/confirmação — não são as cores
// operacionais reservadas). "positivo" adicionado em 25/08/2026: o gerente
// pediu um sinal verde explícito quando a localização confere, não só
// silêncio quando está tudo certo.
type Tone = "neutro" | "alerta" | "positivo";

const TONE_CLASS: Record<Tone, { text: string; dot: string }> = {
  neutro: { text: "text-text-tertiary", dot: "bg-text-tertiary" },
  alerta: { text: "font-semibold text-danger", dot: "bg-danger" },
  positivo: { text: "font-medium text-success", dot: "bg-success" },
};

export function IntegridadeBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const c = TONE_CLASS[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}
