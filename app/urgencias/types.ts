import type { Prioridade } from "@/app/chamados/prioridade-badge";
import type { StatusChamado } from "@/app/chamados/status-chamado-badge";
import type { UrgenciaStatus } from "./urgencia-status-badge";
import type { UrgenciaOrigem } from "./urgencia-origem";

// Compartilhado entre page.tsx (server), urgencias-manager.tsx e
// urgencia-card.tsx (client) — arquivo próprio pra evitar import circular
// entre manager e card.
//
// Modelo "chamado primeiro" (migration 0045, 11/09/2026): a urgência nunca
// duplica dado do chamado — RT/prioridade/SLA/status aqui SEMPRE vêm do
// `chamados` vinculado (nunca são digitados de novo). `chamadoPrioridade` é
// a prioridade ORIGINAL do TomTicket, nunca escrita por este módulo — ver
// `prioridadeUrgencia` pra a classificação própria da urgência (opcional,
// só existe depois de validada; conceito separado de propósito).
export type UrgenciaRow = {
  id: string;
  codigo: string;
  status: "solicitada" | "em_analise" | "validada" | "nao_validada" | "em_atendimento" | "cancelada";
  statusDisplay: UrgenciaStatus; // inclui os estados derivados do servico — nunca gravados no banco
  chamadoId: string;
  tomticketId: string | null;
  chamadoAssunto: string;
  chamadoPrioridade: Prioridade;
  chamadoStatus: StatusChamado;
  chamadoSlaPrazo: string | null;
  rtCodigo: string;
  rtNome: string;
  rtEndereco: string;
  regiaoNome: string;
  motivo: string;
  origem: UrgenciaOrigem;
  solicitante: string;
  prioridadeUrgencia: Prioridade | null;
  criadoEm: string;
  equipeMaisProxima: { nome: string; distanciaKm: number } | null;
};
