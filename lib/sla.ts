export type SlaStatus = "dentro" | "proximo" | "vencido";

// Espelha fn_sla_status (supabase/migrations/0001_init_schema.sql) — mantém
// a mesma regra (vencido = passou do prazo; próximo = últimas 4h antes do
// prazo) pro server component renderizar o badge sem round-trip extra ao
// banco por linha.
export function computeSlaStatus(slaPrazo: string | null): SlaStatus {
  if (!slaPrazo) return "dentro";
  const prazo = new Date(slaPrazo).getTime();
  const agora = Date.now();
  if (agora > prazo) return "vencido";
  if (agora > prazo - 4 * 60 * 60 * 1000) return "proximo";
  return "dentro";
}
