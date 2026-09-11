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
  // Carga de trabalho do técnico responsável pela parada de referência —
  // só exibição/ranqueamento, nunca some uma opção (item 10 do spec: a
  // recomendação nunca impede a escolha manual).
  tecnicoOcupadoAgora: boolean;
  tecnicoServicosRestantesHoje: number;
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

export async function calcularImpactoUrgencia(
  urgenciaRt: PontoGeografico,
  rotasAtivas: RotaAtivaHoje[],
  disponibilidadePorTecnico: Map<string, DisponibilidadeTecnico> = new Map(),
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
      tecnicoOcupadoAgora: disponibilidade?.ocupadoAgora ?? false,
      tecnicoServicosRestantesHoje: disponibilidade?.restantesHoje ?? 0,
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
