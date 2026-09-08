// TomTicket não tem uma URL de "abrir chamado direto pelo protocolo" — a
// tela de detalhe usa um id interno (hash) que a gente não guarda em
// lugar nenhum (só importamos `tomticket_id`, o número do protocolo).
// O link que dá pra montar sem integrar a API (Fase 5) é o de busca já
// filtrada pelo protocolo — leva pra uma tela com o chamado como único
// resultado, e o usuário clica nele pra abrir de verdade. Padrão de URL
// confirmado pelo usuário testando ao vivo em 19/08/2026.
//
// Continua útil mesmo depois da integração da API (migration 0028): o
// gerente usa esse link pra CONFERIR no TomTicket o que o sistema enviou.
const TOMTICKET_SEARCH_URL = "https://console.tomticket.com/dashboard/general-search";

export function tomticketSearchUrl(protocolo: string): string {
  return `${TOMTICKET_SEARCH_URL}?query=${encodeURIComponent(protocolo)}`;
}
