import { panoramaChamadosAgora } from "./blocos/panorama-chamados-agora";
import { rtMaisChamadosAgora } from "./blocos/rt-mais-chamados-agora";
import { gargalosAgora } from "./blocos/gargalos-agora";
import { rotasHoje } from "./blocos/rotas-hoje";
import { nucleosAgora } from "./blocos/nucleos-agora";
import { rtMaisAtendidaPeriodo } from "./blocos/rt-mais-atendida-periodo";
import { volumeRegiaoPeriodo } from "./blocos/volume-regiao-periodo";
import { cumprimentoSlaPeriodo } from "./blocos/cumprimento-sla-periodo";
import { rotasPeriodo } from "./blocos/rotas-periodo";
import type { BlocoModulo, BlocoId } from "./types";

// Fonte única do catálogo — modal (gerador-modal.tsx) e página impressa
// (gerar/page.tsx) leem só daqui. Pra adicionar um bloco novo no futuro:
// criar o arquivo em blocos/, seguindo o mesmo formato de qualquer um dos
// 9 já existentes, e registrar aqui — nada mais precisa mudar.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CATALOGO_BLOCOS: BlocoModulo<any>[] = [
  panoramaChamadosAgora,
  rtMaisChamadosAgora,
  gargalosAgora,
  rotasHoje,
  nucleosAgora,
  rtMaisAtendidaPeriodo,
  volumeRegiaoPeriodo,
  cumprimentoSlaPeriodo,
  rotasPeriodo,
];

export function buscarBloco(id: BlocoId): BlocoModulo<unknown> | undefined {
  return CATALOGO_BLOCOS.find((b) => b.definicao.id === id);
}

export const BLOCOS_AGORA = CATALOGO_BLOCOS.filter((b) => b.definicao.grupo === "agora");
export const BLOCOS_PERIODO = CATALOGO_BLOCOS.filter((b) => b.definicao.grupo === "periodo");

export const IDS_PADRAO: BlocoId[] = CATALOGO_BLOCOS.filter((b) => b.definicao.padrao).map((b) => b.definicao.id);
