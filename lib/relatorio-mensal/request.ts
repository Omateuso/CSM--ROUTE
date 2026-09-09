import type { FiltroRelatorioMensal } from "./tipos";
import { mesFechadoAnterior, mesParaPeriodo } from "./periodo";

const RE_MES = /^\d{4}-\d{2}$/;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

// Lê o filtro dos query params das rotas de geração/prévia. Aceita `mes`
// ("YYYY-MM", caminho normal da UI) ou um par `inicio`/`fim` ("YYYY-MM-DD",
// pra um período livre). Sem nada válido → mês fechado anterior.
export function lerFiltro(sp: URLSearchParams): FiltroRelatorioMensal {
  const mes = sp.get("mes");
  const inicioRaw = sp.get("inicio");
  const fimRaw = sp.get("fim");

  let inicio: string;
  let fim: string;
  if (mes && RE_MES.test(mes)) {
    ({ inicio, fim } = mesParaPeriodo(mes));
  } else if (inicioRaw && fimRaw && RE_DATA.test(inicioRaw) && RE_DATA.test(fimRaw) && inicioRaw <= fimRaw) {
    inicio = inicioRaw;
    fim = fimRaw;
  } else {
    ({ inicio, fim } = mesParaPeriodo(mesFechadoAnterior()));
  }

  return {
    inicio,
    fim,
    capsId: sp.get("caps") || null,
    regiaoId: sp.get("regiao") || null,
  };
}
