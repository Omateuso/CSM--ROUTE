// Helpers de período. O relatório é mensal por natureza (o PowerPoint que ele
// substitui é "Agosto 2026", "Período: 01/08/2026 – 31/08/2026"), então a UI
// usa <input type="month"> — mas as rotas de geração aceitam um intervalo
// livre (inicio/fim) pra não travar um relatório de período fora do mês
// fechado se precisar depois.

export function mesParaPeriodo(mesISO: string): { inicio: string; fim: string } {
  const [ano, mes] = mesISO.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate(); // dia 0 do mês seguinte = último dia deste
  return {
    inicio: `${mesISO}-01`,
    fim: `${mesISO}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

export function mesFechadoAnterior(hoje = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function rotularMes(mesISO: string): string {
  const [ano, mes] = mesISO.split("-").map(Number);
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(ano, mes - 1, 1));
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${ano}`;
}

export function formatarData(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

export function formatarIntervalo(inicio: string, fim: string): string {
  return `${formatarData(`${inicio}T00:00:00`)} – ${formatarData(`${fim}T00:00:00`)}`;
}
