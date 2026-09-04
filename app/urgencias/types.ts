import type { Prioridade } from "@/app/chamados/prioridade-badge";
import type { UrgenciaStatus } from "./urgencia-status-badge";

// Compartilhado entre page.tsx (server), urgencias-manager.tsx e
// urgencia-card.tsx (client) — arquivo próprio pra evitar import circular
// entre manager e card.
export type UrgenciaRow = {
  id: string;
  codigo: string;
  status: "solicitada" | "em_analise" | "validada" | "nao_validada" | "em_atendimento" | "cancelada";
  statusDisplay: UrgenciaStatus; // inclui "concluida", derivado — nunca gravado no banco
  rtId: string;
  rtCodigo: string;
  rtNome: string;
  rtEndereco: string;
  regiaoNome: string;
  descricao: string;
  motivo: string;
  solicitante: string;
  prioridade: Prioridade | null;
  criadoEm: string;
  tomticketId: string | null;
  equipeMaisProxima: { nome: string; distanciaKm: number } | null;
};
