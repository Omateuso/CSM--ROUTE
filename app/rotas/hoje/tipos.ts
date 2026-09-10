export type ParadaStatus = "nao_iniciada" | "em_andamento" | "concluida";

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

// Traçado de rua da rota PLANEJADA (paradas na ordem confirmada), vindo do
// provedor de rotas. Diferente da `trilha` do técnico, que é o caminho
// realmente percorrido (pings de GPS). As duas aparecem juntas no mapa.
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

export type TecnicoAoVivo = {
  id: string;
  nome: string;
  /** Cor da EQUIPE (decisão do usuário, 10/09/2026) — técnicos da mesma equipe compartilham. */
  cor: string;
  /** Vai dentro do pino no mapa. `null` se o técnico não tem equipe. */
  equipeNumero: number | null;
  equipeNome: string | null;
  /** Rota que ele cobre hoje — o mapa usa pra não desenhar o planejado por cima do ao vivo. */
  rotaId: string | null;
  trilha: { lat: number; lng: number }[];
  ultima: { lat: number; lng: number; em: string } | null;
  /**
   * O caminho que ele está seguindo agora: da posição atual pelas paradas
   * que faltam. Mesmo percurso que o link do Google Maps abre no celular
   * dele. `null` sem posição, sem parada pendente ou sem provedor.
   */
  rotaAoVivo: { lat: number; lng: number }[] | null;
  /** `true` quando o caminho ao vivo é linha reta (sem provedor). */
  rotaAoVivoAproximada: boolean;
  /** Distância sempre; tempo só quando há provedor de rota. */
  proxima: { rtCodigo: string; distanciaKm: number; duracaoMin: number | null } | null;
};
