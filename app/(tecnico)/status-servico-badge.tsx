import { StatusDot } from "@/lib/ui/status-dot";

export type StatusServico =
  | "planejado"
  | "em_deslocamento"
  | "em_execucao"
  | "concluido_tecnico"
  | "aguardando_validacao"
  | "validado"
  | "cancelado";

// "em_deslocamento" e "aguardando_validacao" não são atingidos por nenhuma
// função da Fase 3 (fluxo de 1 passo decidido com o usuário: iniciar leva
// direto a em_execucao; a fila de validação é desenho da Fase 4) — os
// rótulos ficam prontos aqui mesmo assim, pra um serviço nunca renderizar
// sem badge se esses status passarem a ser usados depois. "cancelado"
// (0018, ganhou mais caminhos pra chegar nele na 0025 — recusar/pendência
// de material) precisa estar aqui senão a tela quebra (undefined.label) se
// um serviço de hoje for cancelado enquanto o técnico ainda está nela.
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
  cancelado: { label: "Cancelado", dotClass: "border border-text-tertiary", textClass: "text-text-tertiary" },
};

export function StatusServicoBadge({ status }: { status: StatusServico }) {
  const c = CONFIG[status];
  return <StatusDot label={c.label} dotClassName={c.dotClass} textClassName={c.textClass} />;
}
