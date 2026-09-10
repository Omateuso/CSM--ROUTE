"use client";

import dynamic from "next/dynamic";
import type { MapaBaseProps } from "./tipos";

export type { LinhaMapa, MapaBaseProps, MarcadorMapa } from "./tipos";
export type { EspecMarcador } from "./marcador";

// O Leaflet acessa `window` já no import, então o componente real não pode
// ser renderizado no servidor. Este wrapper concentra o `ssr: false` num
// lugar só — as telas importam MapaBase e não precisam saber disso.
const Interno = dynamic(() => import("./mapa-base-interno").then((m) => m.MapaBaseInterno), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-[var(--radius-md)] border border-border bg-skeleton" />
  ),
});

export function MapaBase(props: MapaBaseProps) {
  return <Interno {...props} />;
}
