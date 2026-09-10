"use client";

import { useState } from "react";
import { RotaHojeMapa } from "./rota-hoje-mapa";
import { RotasHojeLista } from "./rotas-hoje-lista";
import type { RotaHoje, TracadoPlanejado } from "./tipos";

// Segura qual rota está selecionada e liga o mapa à lista.
//
// Com mais de uma equipe em campo, desenhar todos os caminhos ao mesmo tempo
// vira uma sopa de linhas cruzadas. Então: uma rota só, o caminho aparece
// direto; mais de uma, o gerente clica na equipe e vê o caminho DAQUELA
// equipe, com as paradas das outras apagadas em vez de escondidas.
export function RotaHojePainel({
  rotas,
  tracados,
}: {
  rotas: RotaHoje[];
  tracados: TracadoPlanejado[];
}) {
  const [selecionada, setSelecionada] = useState<string | null>(null);

  // Uma rota só não exige escolha — mostra o caminho dela direto.
  const rotaAtiva = rotas.length === 1 ? rotas[0].id : selecionada;

  return (
    <>
      {rotas.length > 1 && (
        <p className="mb-2 text-xs text-text-tertiary">
          {rotaAtiva
            ? "Mostrando o caminho da equipe selecionada — clique de novo para ver todas as paradas."
            : "Clique numa equipe abaixo para ver o caminho que ela vai seguir."}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="h-[420px] lg:h-[600px]">
          <RotaHojeMapa rotas={rotas} tracados={tracados} rotaAtiva={rotaAtiva} />
        </div>
        <RotasHojeLista
          rotas={rotas}
          rotaAtiva={rotaAtiva}
          onSelecionar={(id) => setSelecionada((atual) => (atual === id ? null : id))}
          selecionavel={rotas.length > 1}
        />
      </div>
    </>
  );
}
