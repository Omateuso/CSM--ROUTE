import { provedorOrs } from "./ors/cliente";
import { provedorOsrm } from "./osrm/cliente";
import type { ProvedorRotas } from "./tipos";

export type { ElementoMatrizRota, ProvedorRotas, TracadoRota } from "./tipos";

// Ponto único de escolha do provedor de rotas.
//
// `ROTAS_PROVEDOR=ors` (padrão) usa o OpenRouteService com chave gratuita.
// `ROTAS_PROVEDOR=osrm` aponta pro OSRM de `OSRM_BASE_URL` — é o caminho da
// migração pro servidor interno: sobe o container, muda a variável, e
// nenhuma linha de código de negócio precisa saber.
//
// Quem consome (lib/routing/intelligent-route.ts e urgencia-impacto.ts) já
// trata falha caindo pra Haversine, então um provedor fora do ar degrada a
// qualidade da sugestão em vez de derrubar a tela.
export function obterProvedor(): ProvedorRotas {
  return (process.env.ROTAS_PROVEDOR ?? "ors").toLowerCase() === "osrm" ? provedorOsrm : provedorOrs;
}
