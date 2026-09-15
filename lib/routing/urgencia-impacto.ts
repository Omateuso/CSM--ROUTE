// Central de Urgências (04/09/2026) — resolve um problema diferente do
// motor de "montar rota do zero" (intelligent-route.ts/score.ts/clusters.ts):
// aqui as rotas do dia JÁ estão confirmadas e em andamento; a pergunta é
// "qual das poucas equipes ativas hoje absorve 1 parada forçada, e a que
// custo" — por isso é um módulo irmão pequeno, não um encaixe forçado no
// motor existente (ver nota no plano aprovado).
//
// Reaproveita sem alterar: o provedor de rotas (lib/maps/provedor.ts,
// deslocamento real de carro) e haversineKm (proximity.ts, fallback quando o
// provedor falhar — mesmo comportamento gracioso já usado em
// intelligent-route.ts, provedor sem chave configurada inclusive).
import { obterProvedor } from "@/lib/maps/provedor";
import type { ElementoMatrizRota } from "@/lib/maps/provedor";
import { haversineKm, type PontoGeografico } from "./proximity";
import { URGENCIA_PENALIDADE_TECNICO_OCUPADO_KM } from "./config";

export type ParadaRota = {
  rtId: string;
  codigo: string;
  lat: number;
  lng: number;
  ordem: number;
  tecnicoId: string | null;
  tecnicoNome: string | null;
  // "feita" = nenhum serviço dessa parada ainda está planejado/em_execucao
  // (inclusive quando não existe serviço nenhum ali — nada pendente).
  feita: boolean;
};

// Sinal de disponibilidade SEM GPS ao vivo (decisão de 11/09/2026, ver
// cabeçalho da migration 0045): só o que já é observável hoje —
// "esse técnico tem um atendimento em execução agora" e "quantos serviços
// ainda restam pra ele hoje". Calculado pelo chamador (uma query em
// `servicos`) e passado pronto — este módulo não fala com o banco.
export type DisponibilidadeTecnico = { ocupadoAgora: boolean; restantesHoje: number };

// Localização ESTIMADA (migration 0057, 15/09/2026 — nunca GPS ao vivo, ver
// o cabeçalho daquela migration). `insercao`/`fimDeRota` continuam ancoradas
// na PRÓXIMA/ÚLTIMA parada da rota planejada (modelam o desvio marginal de
// um trecho já definido — não precisam saber onde o técnico está agora).
// `otimizada` (abaixo) É alimentada por ela: sem essa leitura o módulo não
// tem como saber a posição física atual, então só compara gaps ENTRE
// paradas planejadas; com ela, ganha um candidato a mais — "ir direto pra
// urgência a partir de onde o técnico está agora, antes de seguir pra
// próxima parada" — que é justamente "com base na última interação/posição
// conhecida do técnico", não só a ordem planejada da rota (16/09/2026,
// fechando a lacuna que tinha ficado registrada como próximo passo).
// Nunca decide sozinho (mesma regra de sempre: recomendação nunca impede
// escolha manual) — a idade da leitura viaja junto (`atualizadoEm`) pro
// gerente julgar se ainda vale confiar nela.
// `rtCodigo` só vem preenchido quando a leitura é derivada da ÚLTIMA
// ATIVIDADE real do técnico hoje (RT de um serviço iniciado/concluído,
// ver page.tsx) — ausente quando a leitura é pura localização por GPS
// (0057). Quem monta o Map decide qual das duas fontes usar por técnico
// (a mais recente das duas vence — nenhuma é fixa por cima da outra).
export type LocalizacaoEstimada = PontoGeografico & { atualizadoEm: string; rtCodigo?: string };

export type RotaAtivaHoje = {
  rotaId: string;
  equipeId: string;
  equipeNome: string;
  paradas: ParadaRota[];
};

export type ImpactoDistancia = { distanciaKm: number; duracaoMin: number | null };

// `insercao` compara "ir direto da próxima parada pendente pra seguinte"
// contra "desviar pela urgência no meio do caminho" — é o "Opção A: inserir
// entre C e D" do fluxo. `fimDeRota` é sempre a distância da ÚLTIMA parada da
// rota (feita ou não) até a urgência — "Opção B: atender depois de F". As
// duas opções levam à MESMA ação no banco (a parada nova é sempre anexada ao
// fim da rota — nunca há renumeração física de `ordem`, ver migration 0027);
// a diferença é só qual comparação de impacto o gerente está olhando.
// "Otimizar para a rota atual" (pedido do usuário, 15/09/2026) — em vez de
// comparar só duas posições fixas (logo depois da próxima parada, ou no
// fim), testa TODOS os intervalos entre as paradas ainda não feitas e
// recomenda o de menor custo (cheapest insertion). Quando há uma leitura de
// localização estimada do técnico responsável (0057), também testa "antes
// da primeira parada pendente" — a partir de onde ele está agora, não de
// uma RT planejada (16/09/2026, ver comentário de `LocalizacaoEstimada`
// acima). Sem essa leitura, cai pro comportamento anterior (só os gaps
// entre paradas planejadas).
export type MelhorInsercao = {
  /**
   * Código da RT logo ANTES do ponto de inserção recomendado.
   * `null` = a partir de onde o técnico está agora (localização estimada),
   * não de uma parada da rota — só acontece quando essa leitura existe.
   */
  aposCodigo: string | null;
  /** Código da RT logo DEPOIS — null = recomendação é inserir no fim da rota. */
  antesCodigo: string | null;
  impacto: ImpactoDistancia;
};

export type OpcaoAtendimentoUrgencia = {
  rotaId: string;
  equipeId: string;
  equipeNome: string;
  tecnicoId: string | null;
  tecnicoNome: string | null;
  proximaParadaCodigo: string | null; // null = rota já concluída hoje
  ultimaParadaCodigo: string;
  insercao: ImpactoDistancia | null; // null quando não há parada pendente pra comparar
  fimDeRota: ImpactoDistancia;
  otimizada: MelhorInsercao | null; // null quando não há parada pendente nenhuma pra testar
  // Carga de trabalho do técnico responsável pela parada de referência —
  // só exibição/ranqueamento, nunca some uma opção (item 10 do spec: a
  // recomendação nunca impede a escolha manual).
  tecnicoOcupadoAgora: boolean;
  tecnicoServicosRestantesHoje: number;
  // Distância em linha reta da localização ESTIMADA do técnico (se houver
  // leitura) até a urgência — sinal extra, não entra na matemática de
  // inserção/fim de rota (essa continua ancorada na rota planejada).
  distanciaEstimadaAtualKm: number | null;
  localizacaoAtualizadaEm: string | null;
  // Código da RT da última atividade real, quando é essa a fonte da
  // leitura acima (não GPS) — deixa explícito pro gerente de onde veio o
  // número, em vez de um "localização estimada" genérico.
  origemRtCodigo: string | null;
};

async function distanciasOuFallback(
  origem: PontoGeografico,
  destinos: PontoGeografico[],
): Promise<ImpactoDistancia[]> {
  if (destinos.length === 0) return [];
  try {
    const matriz = await obterProvedor().matriz(origem, destinos);
    return matriz.map((m, indice) => ({
      distanciaKm: m.distanciaKm ?? haversineKm(origem, destinos[indice]),
      duracaoMin: m.duracaoMin,
    }));
  } catch (err) {
    console.warn("Provedor de rotas indisponível pro impacto de urgência, caindo pra Haversine:", err);
    return destinos.map((d) => ({ distanciaKm: haversineKm(origem, d), duracaoMin: null }));
  }
}

function somarImpacto(a: ImpactoDistancia, b: ImpactoDistancia, c: ImpactoDistancia): ImpactoDistancia {
  // (a + b) - c, sem deixar negativo por imprecisão de arredondamento.
  const distanciaKm = Math.max(0, a.distanciaKm + b.distanciaKm - c.distanciaKm);
  const duracaoMin =
    a.duracaoMin != null && b.duracaoMin != null && c.duracaoMin != null
      ? Math.max(0, a.duracaoMin + b.duracaoMin - c.duracaoMin)
      : null;
  return { distanciaKm, duracaoMin };
}

// `matrizCompleta` (1 requisição só, cobrindo todas as paradas restantes +
// a urgência) em vez de repetir o padrão de `distanciasOuFallback` par-a-par
// que `insercao`/`fimDeRota` usam — mesma técnica já usada em
// lib/routing/otimizar-visita.ts pra rota otimizada do técnico.
async function calcularMelhorInsercao(
  urgenciaRt: PontoGeografico,
  paradasRestantes: ParadaRota[],
  origemAtual: LocalizacaoEstimada | null,
): Promise<MelhorInsercao | null> {
  const n = paradasRestantes.length;
  if (n === 0) return null;

  const idxUrgencia = n;
  const idxOrigemAtual = origemAtual ? n + 1 : -1;
  const pontos: PontoGeografico[] = origemAtual
    ? [...paradasRestantes, urgenciaRt, origemAtual]
    : [...paradasRestantes, urgenciaRt];

  let matriz: ElementoMatrizRota[][] | null;
  try {
    matriz = await obterProvedor().matrizCompleta(pontos);
  } catch (err) {
    console.warn("Provedor de rotas indisponível pra melhor inserção de urgência, caindo pra Haversine:", err);
    matriz = null;
  }

  function impactoEntre(i: number, j: number): ImpactoDistancia {
    const m = matriz?.[i]?.[j];
    return {
      distanciaKm: m?.distanciaKm ?? haversineKm(pontos[i], pontos[j]),
      duracaoMin: m?.duracaoMin ?? null,
    };
  }
  function custo(i: number, j: number): number {
    const impacto = impactoEntre(i, j);
    return impacto.duracaoMin ?? impacto.distanciaKm;
  }

  // Candidatos: um gap por parada restante — "depois de paradasRestantes[g]"
  // (e "antes de paradasRestantes[g+1]", exceto no último gap, que é "no
  // fim da rota"). n candidatos no total, todos dentro da MESMA matriz já
  // calculada acima. Mais um candidato extra (g = -1, sentinel), só quando
  // há localização estimada do técnico responsável: "antes da primeira
  // parada pendente", medido a partir de onde ele está agora — é o único
  // candidato que reflete posição REAL, não planejada.
  let melhorG = 0;
  let melhorCusto = Infinity;
  for (let g = 0; g < n; g++) {
    const c = g < n - 1 ? custo(g, idxUrgencia) + custo(idxUrgencia, g + 1) - custo(g, g + 1) : custo(g, idxUrgencia);
    if (c < melhorCusto) {
      melhorCusto = c;
      melhorG = g;
    }
  }
  if (origemAtual) {
    const c = custo(idxOrigemAtual, idxUrgencia) + custo(idxUrgencia, 0) - custo(idxOrigemAtual, 0);
    if (c < melhorCusto) {
      melhorCusto = c;
      melhorG = -1;
    }
  }

  if (melhorG === -1) {
    const impacto = somarImpacto(
      impactoEntre(idxOrigemAtual, idxUrgencia),
      impactoEntre(idxUrgencia, 0),
      impactoEntre(idxOrigemAtual, 0),
    );
    return { aposCodigo: null, antesCodigo: paradasRestantes[0].codigo, impacto };
  }

  const impactoAntes = impactoEntre(melhorG, idxUrgencia);
  const temDepois = melhorG < n - 1;
  const impacto = temDepois
    ? somarImpacto(impactoAntes, impactoEntre(idxUrgencia, melhorG + 1), impactoEntre(melhorG, melhorG + 1))
    : impactoAntes;

  return {
    aposCodigo: paradasRestantes[melhorG].codigo,
    antesCodigo: temDepois ? paradasRestantes[melhorG + 1].codigo : null,
    impacto,
  };
}

export async function calcularImpactoUrgencia(
  urgenciaRt: PontoGeografico,
  rotasAtivas: RotaAtivaHoje[],
  disponibilidadePorTecnico: Map<string, DisponibilidadeTecnico> = new Map(),
  localizacaoPorTecnico: Map<string, LocalizacaoEstimada> = new Map(),
): Promise<OpcaoAtendimentoUrgencia[]> {
  const resultado: OpcaoAtendimentoUrgencia[] = [];

  for (const rota of rotasAtivas) {
    const paradas = [...rota.paradas].sort((a, b) => a.ordem - b.ordem);
    const ultima = paradas[paradas.length - 1];
    if (!ultima) continue; // rota sem nenhuma parada — não deveria acontecer, defensivo

    const proxima = paradas.find((p) => !p.feita) ?? null;
    const depois = proxima ? (paradas.find((p) => p.ordem === proxima.ordem + 1) ?? null) : null;

    let insercao: ImpactoDistancia | null = null;
    let fimDeRota: ImpactoDistancia;

    if (proxima) {
      const destinos = depois ? [urgenciaRt, depois] : [urgenciaRt];
      const [proximaParaUrgencia, proximaParaDepois] = await distanciasOuFallback(proxima, destinos);

      if (depois && proximaParaDepois) {
        const [urgenciaParaDepois] = await distanciasOuFallback(urgenciaRt, [depois]);
        insercao = somarImpacto(proximaParaUrgencia, urgenciaParaDepois, proximaParaDepois);
      } else {
        insercao = proximaParaUrgencia;
      }

      fimDeRota =
        proxima.rtId === ultima.rtId ? proximaParaUrgencia : (await distanciasOuFallback(ultima, [urgenciaRt]))[0];
    } else {
      fimDeRota = (await distanciasOuFallback(ultima, [urgenciaRt]))[0];
    }

    const referencia = proxima ?? ultima;
    const disponibilidade = referencia.tecnicoId ? disponibilidadePorTecnico.get(referencia.tecnicoId) : undefined;
    const localizacao = referencia.tecnicoId ? localizacaoPorTecnico.get(referencia.tecnicoId) : undefined;
    const paradasRestantes = paradas.filter((p) => !p.feita);
    const otimizada = await calcularMelhorInsercao(urgenciaRt, paradasRestantes, localizacao ?? null);

    resultado.push({
      rotaId: rota.rotaId,
      equipeId: rota.equipeId,
      equipeNome: rota.equipeNome,
      tecnicoId: referencia.tecnicoId,
      tecnicoNome: referencia.tecnicoNome,
      proximaParadaCodigo: proxima?.codigo ?? null,
      ultimaParadaCodigo: ultima.codigo,
      insercao,
      fimDeRota,
      otimizada,
      tecnicoOcupadoAgora: disponibilidade?.ocupadoAgora ?? false,
      tecnicoServicosRestantesHoje: disponibilidade?.restantesHoje ?? 0,
      distanciaEstimadaAtualKm: localizacao ? haversineKm(localizacao, urgenciaRt) : null,
      localizacaoAtualizadaEm: localizacao?.atualizadoEm ?? null,
      origemRtCodigo: localizacao?.rtCodigo ?? null,
    });
  }

  // Menor impacto AJUSTADO primeiro — usa a melhor das duas opções
  // disponíveis, penalizando (nunca descartando) o técnico já ocupado agora
  // com um atendimento em execução. Ex. do spec original: técnico a 2km mas
  // em atendimento perde pro técnico a 4km livre.
  function distanciaAjustada(o: OpcaoAtendimentoUrgencia): number {
    const menor = Math.min(o.insercao?.distanciaKm ?? Infinity, o.fimDeRota.distanciaKm);
    return o.tecnicoOcupadoAgora ? menor + URGENCIA_PENALIDADE_TECNICO_OCUPADO_KM : menor;
  }

  resultado.sort((a, b) => distanciaAjustada(a) - distanciaAjustada(b));

  return resultado;
}
