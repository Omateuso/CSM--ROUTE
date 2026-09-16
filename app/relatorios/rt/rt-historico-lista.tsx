"use client";

import { useRouter } from "next/navigation";
import { RtPicker, type RtOpcao } from "./rt-picker";

// A mesma busca de RT do formulário, mas aqui selecionar leva pro histórico
// da RT (não avança um formulário) — cada resultado mostra também quantos
// relatórios já existem pra ela.
export function RtHistoricoLista({
  rts,
  contagemPorRt,
}: {
  rts: RtOpcao[];
  contagemPorRt: Record<string, number>;
}) {
  const router = useRouter();

  return (
    <RtPicker
      rts={rts}
      onSelecionar={(rt) => router.push(`/relatorios/rt/${rt.id}`)}
      contagemPorRt={contagemPorRt}
      autoFocus
    />
  );
}
