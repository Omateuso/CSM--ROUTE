import type { ReactNode } from "react";
import type { PontoGeografico } from "@/lib/routing/proximity";
import type { EspecMarcador } from "./marcador";

export type MarcadorMapa = {
  id: string;
  posicao: PontoGeografico;
  espec: EspecMarcador;
  /** Tooltip nativo (o `title` que os mapas do Google já usavam). */
  titulo?: string;
  zIndex?: number;
  aoClicar?: () => void;
  /** Conteúdo do popup. Abre no clique do marcador, fecha no X ou no mapa. */
  popup?: ReactNode;
};

export type LinhaMapa = {
  id: string;
  pontos: PontoGeografico[];
  cor: string;
  opacidade?: number;
  espessura?: number;
  tracejada?: boolean;
};

export type MapaBaseProps = {
  marcadores: MarcadorMapa[];
  linhas?: LinhaMapa[];
  /** Pontos pro enquadramento inicial. Default: os próprios marcadores. */
  ajustarA?: PontoGeografico[];
  /** `true` reenquadra sempre que os pontos mudam (só o Mapa operacional faz isso). */
  ajustarSempre?: boolean;
  className?: string;
  /** Sobreposições fora do mapa (legenda, por exemplo). */
  children?: ReactNode;
};
