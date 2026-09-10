// 4 estados, não 3: "alguém está atendendo AGORA" (`em_atendimento`) é
// diferente de "a parada tem progresso, mas ninguém está nela" (`parcial`).
// Colapsar os dois fazia a tela dizer "Atendimento em andamento" para uma
// parada parada — exatamente o oposto do que o gerente precisa ler.
export type ParadaStatus = "nao_iniciada" | "parcial" | "em_atendimento" | "concluida";

export type ParadaHoje = {
  ordem: number;
  rtId: string;
  rtCodigo: string;
  rtNome: string;
  rtEndereco: string;
  lat: number | null;
  lng: number | null;
  tecnicoId: string | null;
  tecnicoNome: string | null;
  status: ParadaStatus;
  servicos: { status: string; assunto: string; prioridade: string; protocolo: string | null }[];
};

export type RotaHoje = {
  id: string;
  equipeNome: string;
  equipeNumero: number | null;
  regiaoNome: string;
  progresso: { feitas: number; total: number };
  paradas: ParadaHoje[];
};

// Traçado de rua da rota planejada (paradas na ordem confirmada), vindo do
// provedor de rotas. É o caminho que a equipe vai seguir — não depende de
// saber onde o técnico está, e por isso sobreviveu à remoção do
// rastreamento de posição (migration 0041).
export type TracadoPlanejado = {
  rotaId: string;
  pontos: { lat: number; lng: number }[];
  distanciaKm: number;
  /** `null` quando não há provedor de rota configurado. */
  duracaoMin: number | null;
  /**
   * `true` = as paradas ligadas em linha reta, na ordem da rota, porque o
   * provedor não respondeu. A SEQUÊNCIA está certa; o traçado é que não
   * segue as ruas. A rota nunca some do mapa por falta de integração.
   */
  aproximado: boolean;
};
