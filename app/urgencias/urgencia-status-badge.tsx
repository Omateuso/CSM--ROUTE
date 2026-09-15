import { StatusDot } from "@/lib/ui/status-dot";

// Nenhum destes 3 é gravado em `urgencias.status` (só tem os 6 valores do
// check da migration 0027) — são derivados na leitura a partir do status do
// `servico` vinculado (atendida_por_servico_id), pra não recriar uma segunda
// máquina de estados paralela (seção 19 do prompt: "não criar outro sistema
// de tickets"). O pipeline de `servicos` já distingue exatamente isso:
//   planejado          -> tecnico_escalado ("TÉCNICO DESLOCADO" do prompt)
//   em_execucao        -> em_atendimento
//   concluido_tecnico+ -> concluida
//   cancelado          -> pendente_novo_despacho (reagendamento/pendência
//                         do técnico invalidou o despacho — precisa decidir
//                         de novo; cobre "PENDENTE"/"ENCAMINHADA" do prompt
//                         sem coluna nova)
export type UrgenciaStatus =
  | "solicitada"
  | "em_analise"
  | "validada"
  | "nao_validada"
  | "tecnico_escalado"
  | "em_atendimento"
  | "concluida"
  | "pendente_novo_despacho"
  | "cancelada";

const CONFIG: Record<UrgenciaStatus, { label: string; dotClass: string; textClass: string }> = {
  solicitada: { label: "Solicitada", dotClass: "bg-text-tertiary", textClass: "text-text-secondary" },
  em_analise: { label: "Em análise", dotClass: "bg-priority-alta", textClass: "text-text-secondary" },
  validada: { label: "Aguardando despacho", dotClass: "bg-accent", textClass: "text-accent" },
  nao_validada: {
    label: "Não validada",
    dotClass: "border border-text-tertiary",
    textClass: "text-text-tertiary",
  },
  tecnico_escalado: {
    label: "Técnico escalado",
    dotClass: "bg-accent",
    textClass: "font-semibold text-accent",
  },
  em_atendimento: {
    label: "Em atendimento",
    dotClass: "bg-priority-alta",
    textClass: "font-semibold text-priority-alta",
  },
  concluida: { label: "Concluída", dotClass: "bg-sla-dentro", textClass: "text-sla-dentro" },
  pendente_novo_despacho: {
    label: "Pendente — precisa de novo despacho",
    dotClass: "bg-sla-vencido",
    textClass: "font-semibold text-sla-vencido",
  },
  cancelada: { label: "Cancelada", dotClass: "border border-text-tertiary", textClass: "text-text-tertiary" },
};

export function UrgenciaStatusBadge({ status }: { status: UrgenciaStatus }) {
  const c = CONFIG[status];
  return <StatusDot label={c.label} dotClassName={c.dotClass} textClassName={c.textClass} />;
}

type StatusGravado = "solicitada" | "em_analise" | "validada" | "nao_validada" | "em_atendimento" | "cancelada";

// Compartilhada entre a lista (page.tsx) e o detalhe ([id]/page.tsx) — os
// 3 estados derivados (comentário no topo do arquivo) só fazem sentido
// quando `status` gravado é 'em_atendimento'; fora disso é sempre 1:1.
export function derivarStatusDisplay(status: StatusGravado, servicoStatus: string | null): UrgenciaStatus {
  if (status !== "em_atendimento") return status;
  if (servicoStatus === "planejado" || servicoStatus === null) return "tecnico_escalado";
  // `em_revisao` (0053/0054) é a contraparte leve de `em_execucao` — pro
  // status derivado da urgência, os dois significam a mesma coisa: "o
  // técnico está atendendo agora".
  if (servicoStatus === "em_execucao" || servicoStatus === "em_revisao") return "em_atendimento";
  if (servicoStatus === "cancelado") return "pendente_novo_despacho";
  return "concluida"; // concluido_tecnico | aguardando_validacao | validado
}
