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
  regiaoNome: string;
  progresso: { feitas: number; total: number };
  paradas: ParadaHoje[];
};

export type TecnicoAoVivo = {
  id: string;
  nome: string;
  cor: string;
  trilha: { lat: number; lng: number }[];
  ultima: { lat: number; lng: number; em: string } | null;
};
