export type StatusServico =
  | "planejado"
  | "em_deslocamento"
  | "em_execucao"
  | "concluido_tecnico"
  | "aguardando_validacao"
  | "validado";

// "em_deslocamento" e "aguardando_validacao" não são atingidos por nenhuma
// função da Fase 3 (fluxo de 1 passo decidido com o usuário: iniciar leva
// direto a em_execucao; a fila de validação é desenho da Fase 4) — os
// rótulos ficam prontos aqui mesmo assim, pra um serviço nunca renderizar
// sem badge se esses status passarem a ser usados depois.
const CONFIG: Record<StatusServico, { label: string; dotClass: string; textClass: string }> = {
  planejado: { label: "A fazer", dotClass: "bg-accent", textClass: "text-text-secondary" },
  em_deslocamento: { label: "A caminho", dotClass: "bg-accent", textClass: "text-text-secondary" },
  em_execucao: {
    label: "Em execução",
    dotClass: "bg-priority-alta",
    textClass: "font-semibold text-priority-alta",
  },
  concluido_tecnico: { label: "Concluído", dotClass: "bg-sla-dentro", textClass: "text-sla-dentro" },
  aguardando_validacao: {
    label: "Aguardando validação",
    dotClass: "bg-sla-dentro",
    textClass: "text-text-secondary",
  },
  validado: { label: "Validado", dotClass: "bg-sla-dentro", textClass: "font-semibold text-sla-dentro" },
};

export function StatusServicoBadge({ status }: { status: StatusServico }) {
  const c = CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${c.textClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dotClass}`} aria-hidden="true" />
      {c.label}
    </span>
  );
}
