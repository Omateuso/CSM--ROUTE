import type { ReactNode } from "react";
import { CapturarLocalizacaoInicial } from "./capturar-localizacao-inicial";

// Layout do grupo (tecnico) — recriado em 15/09/2026 (o layout anterior
// tinha sido apagado junto com a Fase 5/tecnico_posicao na migration 0041).
// Só existe pra montar a captura de localização estimada uma vez por
// abertura do app; nenhuma UI própria (o técnico continua sem menu — ver
// app/layout.tsx, "interface mínima, poucos toques por tela").
export default function TecnicoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CapturarLocalizacaoInicial />
      {children}
    </>
  );
}
