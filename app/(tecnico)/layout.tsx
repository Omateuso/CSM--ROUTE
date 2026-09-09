import type { ReactNode } from "react";
import { PosicaoReporter } from "./posicao-reporter";

// Layout do grupo (tecnico) — monta o PosicaoReporter uma vez pra todas as
// telas do técnico (servicos-do-dia, servico/[id]) e o mantém montado
// enquanto ele navega entre elas. O reporter é silencioso e a RLS da
// 0038 (`tecnico_posicao_insert_own`) só deixa um técnico gravar a própria
// posição — se um gerente abrir uma URL de técnico por engano, o insert é
// rejeitado sem efeito.
export default function TecnicoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PosicaoReporter />
    </>
  );
}
