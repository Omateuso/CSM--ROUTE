// Raio de proximidade inicial pra considerar uma RT "candidata" — spec da
// Fase 2 (Parte B, item 3): precisa ser fácil de ajustar (10 km, etc.) sem
// reescrever lógica, nunca hardcoded em múltiplos pontos do código.
export const ROUTE_PROXIMITY_RADIUS_KM = 5;

// Quantas candidatas (mais próximas por Haversine) entram na chamada da
// Routes API — teto de segurança pro tamanho/custo da requisição (item 18:
// reduzir universo de candidatas antes de gastar chamada cara ao Google).
export const MAX_CANDIDATAS_PARA_ROTEIRIZAR = 20;

// Pesos da pontuação (item 9) — nomeados e centralizados pra poderem ser
// calibrados depois de uso real do gerente, sem precisar mexer na fórmula.
// Calibrados contra os dois cenários do item 10 do spec:
//   - RT perto (3km) + 2 SLA vencidos deve vencer RT longe (10km) + mais
//     chamados só que sem nenhum vencido.
//   - RT longe (10km) + 4 emergenciais deve vencer RT perto (3km) só com
//     chamados normais.
export const SCORE_WEIGHTS = {
  proximidadeBase: 10, // pontosProximidade = base / (1 + distanciaKm)
  tempoBase: 10, // pontosTempo = base / (1 + duracaoMin / 10)
  porChamadoAberto: 0.5,
  porAlta: 1.5,
  porEmergencial: 4,
  porSlaProximo: 1,
  porSlaVencido: 3,
  porRtNoNucleo: 0.5, // multiplicado pelo tamanho do núcleo
};

// Núcleo operacional (item 11): RTs a até NUCLEO_EPSILON_KM uma da outra
// entram no mesmo grupo; só vira sugestão de força-tarefa com pelo menos
// NUCLEO_MIN_RTS RTs no grupo.
export const NUCLEO_EPSILON_KM = 0.5;
export const NUCLEO_MIN_RTS = 3;

// Acima disso (relativo ao raio de proximidade), uma candidata é rotulada
// "alto deslocamento" mesmo que tenha pontuação boa por outros motivos.
export const ALTO_DESLOCAMENTO_MULTIPLICADOR = 1.5;

// Auditoria de segurança (Pacote 1, 21/08/2026): distância máxima entre a
// geolocalização da foto de conclusão e a RT cadastrada pra considerar
// "localização confere". Folga generosa (400m) de propósito — GPS indoor
// nas RTs erra bastante, e o objetivo é sinalizar discrepância grande pro
// gerente, nunca bloquear o técnico por erro normal de precisão.
export const EVIDENCIA_DISTANCIA_LIMITE_KM = 0.4;

// Central de Urgências — despacho (11/09/2026). Sem GPS ao vivo do técnico
// (a tabela foi removida de propósito na 0041 — rastreamento contínuo lê
// como fiscalização, contra a filosofia do produto). O sinal de
// "disponibilidade" é a carga de trabalho de hoje: um técnico com um
// atendimento em execução NESTE INSTANTE é penalizado na recomendação,
// tratado como se estivesse esse tanto mais longe — nunca excluído, o
// gerente sempre pode escolher manualmente (a recomendação é auxílio, não
// obrigação — mesma regra da Rota Inteligente).
export const URGENCIA_PENALIDADE_TECNICO_OCUPADO_KM = 3;
