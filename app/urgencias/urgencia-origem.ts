// Origem da urgência (seção 5 do prompt de 11/09/2026) — de onde o relato
// chegou. Puramente informativo/auditoria; nunca influencia despacho ou
// prioridade.
export type UrgenciaOrigem = "whatsapp" | "telefone" | "coordenacao_caps" | "identificacao_operacional" | "outro";

export const URGENCIA_ORIGEM_OPTIONS: { value: UrgenciaOrigem; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telefone", label: "Telefone" },
  { value: "coordenacao_caps", label: "Coordenação do CAPS" },
  { value: "identificacao_operacional", label: "Identificação operacional" },
  { value: "outro", label: "Outro" },
];

export const URGENCIA_ORIGEM_LABEL: Record<UrgenciaOrigem, string> = Object.fromEntries(
  URGENCIA_ORIGEM_OPTIONS.map((o) => [o.value, o.label]),
) as Record<UrgenciaOrigem, string>;
