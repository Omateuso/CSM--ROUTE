// Formato de data que a API v2.0 do TomTicket aceita.
//
// A documentação escreve `YYYY-MM-DD HH:II:SSZ`, mas esse `Z` é OFFSET DE FUSO
// no estilo PHP, não a letra "Z" — o exemplo da própria doc é
// `1970-02-01 14:30:59-0300`.
//
// Isso não é detalhe cosmético: mandar sem o offset faz a API devolver
// HTTP 401 com `{"message":"Invalid date."}` — um 401 que NÃO é problema de
// token (confirmado ao vivo em 08/09/2026). Vale pros filtros `last_update_ge`
// da listagem e pros campos `start_date`/`end_date` da resposta.
//
// O offset é calculado, não fixado em -0300: o Brasil já teve horário de verão
// e pode voltar a ter. Fuso fixado em São Paulo porque o servidor pode rodar em
// UTC (Vercel) e a hora local é a que faz sentido pro chamado.

function offsetSaoPaulo(data: Date): string {
  const nome = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    timeZoneName: "longOffset",
  })
    .formatToParts(data)
    .find((p) => p.type === "timeZoneName")?.value;

  // "GMT-03:00" -> "-0300". "GMT" puro (offset zero) -> "+0000".
  const bruto = (nome ?? "").replace("GMT", "").replace(":", "");
  return bruto === "" ? "+0000" : bruto;
}

// Sentido inverso: a data que a API DEVOLVE (em `replies[].date`,
// `creation_date`, etc.) vem como "YYYY-MM-DD HH:MM:SS-03" — espaço no lugar do
// "T" e offset de 2 dígitos que o `new Date()` não engole. Normaliza pra ISO.
export function pararDataTomTicket(bruto: string): string | null {
  const limpo = (bruto ?? "").trim();
  if (!limpo) return null;
  const iso = limpo
    .replace(" ", "T")
    .replace(/([+-]\d{2})(\d{2})?$/, (_, horas, minutos) => `${horas}:${minutos ?? "00"}`);
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

export function formatarDataTomTicket(data: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(data);

  const pegar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  const local = `${pegar("year")}-${pegar("month")}-${pegar("day")} ${pegar("hour")}:${pegar("minute")}:${pegar("second")}`;

  return `${local}${offsetSaoPaulo(data)}`;
}
