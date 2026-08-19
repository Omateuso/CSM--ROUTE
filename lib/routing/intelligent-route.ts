import { calcularMatrizDistancia } from "@/lib/maps/google/matrix";
import { maisProximas, type PontoGeografico } from "./proximity";
import { detectarNucleos, maiorNucleo, type Nucleo } from "./clusters";
import { calcularScoreInicial, calcularScoreComDeslocamento, gerarMotivo } from "./score";
import { MAX_CANDIDATAS_PARA_ROTEIRIZAR, ROUTE_PROXIMITY_RADIUS_KM, ALTO_DESLOCAMENTO_MULTIPLICADOR } from "./config";

export type RtParaRoteirizacao = PontoGeografico & {
  id: string;
  codigo: string;
  nome: string;
  endereco: string;
  regiaoId: string;
  totalAbertos: number;
  emergenciais: number;
  altas: number;
  vencidos: number;
  proximos: number;
};

export type Rotulo = "recomendada" | "boa_opcao" | "alto_deslocamento";

export type Candidata = {
  rtId: string;
  codigo: string;
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
  distanciaKm: number | null;
  duracaoMin: number | null;
  totalAbertos: number;
  emergenciais: number;
  vencidos: number;
  proximos: number;
  score: number;
  rotulo: Rotulo;
  motivo: string;
};

export type SugestaoRota = {
  candidatas: Candidata[];
  nucleo: Nucleo | null;
};

// Primeira escolha não tem noção de deslocamento (ainda não há RT de
// referência) — só existem dois níveis: a mais relevante operacionalmente,
// e as demais. "Alto deslocamento" não faz sentido nessa etapa.
function rotularSemDeslocamento(candidatas: Candidata[]): void {
  candidatas.forEach((c, indice) => {
    c.rotulo = indice === 0 ? "recomendada" : "boa_opcao";
  });
}

// "Alto deslocamento" precisa continuar honesto sobre o nome dele — só
// entra quem está realmente longe (distância real), nunca quem só tem
// pontuação baixa *relativa* ao topo. Bug real pego em teste manual: uma
// RT a 0,8 km virava "alto deslocamento" só porque outra RT (que tinha
// voltado a ficar disponível depois de removida da rota) tinha pontuação
// operacional muito mais alta e puxou o "melhor score" pra cima — todo o
// resto do lote caía abaixo do corte relativo de 50%, mesmo estando perto.
// "Boa opção" agora é o padrão pra tudo que não é a recomendada nem está
// geograficamente longe, independente de quão mais alto o score do topo é.
function rotularComDeslocamento(candidatas: Candidata[]): void {
  candidatas.forEach((c, indice) => {
    if (indice === 0) {
      c.rotulo = "recomendada";
      return;
    }
    const longeDemais =
      c.distanciaKm !== null && c.distanciaKm > ROUTE_PROXIMITY_RADIUS_KM * ALTO_DESLOCAMENTO_MULTIPLICADOR;
    c.rotulo = longeDemais ? "alto_deslocamento" : "boa_opcao";
  });
}

// Primeira RT da rota — sem referência geográfica ainda (item 6 do spec):
// lista as RTs da região (se informada) ordenadas por relevância
// operacional (volume/prioridade/SLA), sem gastar chamada à Routes API.
function sugerirPrimeiraEscolha(
  candidatas: RtParaRoteirizacao[],
  nucleo: Nucleo | null,
): SugestaoRota {
  const resultado: Candidata[] = candidatas
    .map((r) => ({
      rtId: r.id,
      codigo: r.codigo,
      nome: r.nome,
      endereco: r.endereco,
      lat: r.lat,
      lng: r.lng,
      distanciaKm: null,
      duracaoMin: null,
      totalAbertos: r.totalAbertos,
      emergenciais: r.emergenciais,
      vencidos: r.vencidos,
      proximos: r.proximos,
      score: calcularScoreInicial(r),
      rotulo: "boa_opcao" as Rotulo,
      motivo: gerarMotivo(r),
    }))
    .sort((a, b) => b.score - a.score);

  rotularSemDeslocamento(resultado);
  return { candidatas: resultado, nucleo };
}

// A partir da segunda RT: recalcula sempre a partir da ÚLTIMA RT
// selecionada (item 5 — nunca fica presa na primeira). Filtra candidatas
// por proximidade (Haversine, barato) antes de consultar a Routes API
// (item 18 — reduzir universo antes da chamada cara).
async function sugerirProximaEscolha(
  referencia: RtParaRoteirizacao,
  pool: RtParaRoteirizacao[],
): Promise<SugestaoRota> {
  const proximas = maisProximas(referencia, pool, MAX_CANDIDATAS_PARA_ROTEIRIZAR);
  if (proximas.length === 0) return { candidatas: [], nucleo: null };

  const nucleo = maiorNucleo(detectarNucleos([referencia, ...proximas]));

  // item 8 do spec: distância sempre exibida, tempo só "quando a
  // integração Google estiver disponível" — ou seja, a ausência da
  // integração (chave sem billing, API fora do ar, etc.) é um cenário
  // esperado, não um erro fatal. Se a chamada à Routes API falhar por
  // completo, cai pra Haversine em todas as candidatas (sem duração) em
  // vez de derrubar a sugestão inteira.
  let matriz: Awaited<ReturnType<typeof calcularMatrizDistancia>>;
  try {
    matriz = await calcularMatrizDistancia(referencia, proximas);
  } catch (err) {
    console.warn("Routes API indisponível, caindo pra Haversine:", err);
    matriz = proximas.map(() => ({ distanciaKm: null, duracaoMin: null, rotaEncontrada: false }));
  }

  const resultado: Candidata[] = proximas.map((r, indice) => {
    const m = matriz[indice];
    // se a Routes API falhar pontualmente pra um destino, cai pro
    // Haversine em vez de derrubar a sugestão inteira (item 8: distância
    // sempre exibida; tempo só quando a integração estiver disponível).
    const distanciaKm = m.distanciaKm ?? r.distanciaAprox;
    const duracaoMin = m.duracaoMin;
    const tamanhoNucleo = nucleo?.rtIds.includes(r.id) ? nucleo.rtIds.length : 0;

    return {
      rtId: r.id,
      codigo: r.codigo,
      nome: r.nome,
      endereco: r.endereco,
      lat: r.lat,
      lng: r.lng,
      distanciaKm,
      duracaoMin,
      totalAbertos: r.totalAbertos,
      emergenciais: r.emergenciais,
      vencidos: r.vencidos,
      proximos: r.proximos,
      score: calcularScoreComDeslocamento({ ...r, distanciaKm, duracaoMin: duracaoMin ?? 0, tamanhoNucleo }),
      rotulo: "boa_opcao" as Rotulo,
      motivo: gerarMotivo({ ...r, distanciaKm, duracaoMin: duracaoMin ?? undefined }),
    };
  });

  resultado.sort((a, b) => b.score - a.score);
  rotularComDeslocamento(resultado);
  return { candidatas: resultado, nucleo };
}

export async function sugerirProximasRts(params: {
  todasRts: RtParaRoteirizacao[];
  referenciaRtId: string | null;
  regiaoId: string | null;
  jaSelecionadas: string[];
}): Promise<SugestaoRota> {
  const { todasRts, referenciaRtId, regiaoId, jaSelecionadas } = params;
  const excluidas = new Set(jaSelecionadas);
  const referencia = referenciaRtId ? todasRts.find((r) => r.id === referenciaRtId) ?? null : null;

  if (!referencia) {
    // item 4: região é filtro/contexto na primeira escolha, não barreira
    // geográfica depois — mas antes de qualquer RT escolhida, ainda não
    // existe "geografia de referência", então a região faz sentido como
    // filtro inicial mesmo.
    const pool = todasRts.filter((r) => !excluidas.has(r.id) && (!regiaoId || r.regiaoId === regiaoId));
    const nucleo = maiorNucleo(detectarNucleos(pool));
    return sugerirPrimeiraEscolha(pool, nucleo);
  }

  // item 4: a partir daqui, região NUNCA bloqueia — o pool é todas as RTs
  // ativas, e quem decide é a proximidade geográfica real.
  const pool = todasRts.filter((r) => !excluidas.has(r.id) && r.id !== referencia.id);
  return sugerirProximaEscolha(referencia, pool);
}
