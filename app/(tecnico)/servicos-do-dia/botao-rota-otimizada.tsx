"use client";

import { useState } from "react";
import { otimizarRotaDoDia, type ParadaParaOtimizar } from "./rota-actions";
import { capturarGeolocalizacao } from "@/lib/geolocalizacao";
import { linkGoogleMapsRota, type RotaNavegacao } from "@/lib/navegacao";
import { FOCUS_RING } from "@/lib/ui/styles";

// "Rota otimizada no Google Maps, baseada em tempo, a partir de onde o
// técnico está" (pedido do usuário, 15/09/2026) — antes o link sempre
// visitava as RTs na ordem que o GERENTE planejou (rota_rts.ordem), sem
// nenhuma relação com onde o técnico de fato está quando abre o link. O
// Google Maps não reordena waypoints sozinho (a URL só visita na ordem
// dada) — a ordem já precisa sair certa daqui (lib/routing/otimizar-visita.ts).
export function BotaoRotaOtimizada({
  paradas,
  linkPadrao,
}: {
  /** Uma por RT, na ordem planejada pelo gerente — também serve de fallback
   * se a geolocalização for negada ou o provedor de rotas falhar. */
  paradas: ParadaParaOtimizar[];
  linkPadrao: RotaNavegacao;
}) {
  const [carregando, setCarregando] = useState(false);

  async function abrir() {
    if (carregando) return;
    setCarregando(true);

    // A aba abre JÁ no clique, síncrona — chamar `window.open` depois de um
    // `await` (a geolocalização pode levar até 8s) arrisca o navegador
    // tratar como popup não solicitado e bloquear. Essa aba em branco é
    // redirecionada pro link final assim que ele estiver pronto.
    const novaAba = window.open("", "_blank");
    try {
      novaAba?.document.write(
        '<title>Rota Inteligente</title><body style="font-family:sans-serif;color:#57534e;padding:2rem">Calculando a melhor rota…</body>',
      );
    } catch {
      // só cosmético — sem isso a aba fica em branco por 1-2s, não é um problema real
    }

    try {
      // Ordem só importa com mais de 1 parada — poupa o técnico de um
      // pedido de permissão de localização à toa quando não muda nada.
      const origem = paradas.length > 1 ? await capturarGeolocalizacao() : null;
      let url = linkPadrao.url;

      if (origem) {
        try {
          const otimizadas = await otimizarRotaDoDia(origem, paradas);
          const navegacaoOtimizada = linkGoogleMapsRota(otimizadas);
          if (navegacaoOtimizada) url = navegacaoOtimizada.url;
        } catch {
          // provedor de rotas fora do ar — segue com a ordem planejada (linkPadrao)
        }
      }

      if (novaAba && !novaAba.closed) novaAba.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={carregando}
      className={`mb-3 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-accent bg-accent/5 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 disabled:cursor-wait disabled:opacity-70 ${FOCUS_RING}`}
    >
      <span aria-hidden="true">➤</span>
      {carregando ? "Calculando a melhor rota..." : "Abrir rota no Google Maps"}
    </button>
  );
}
