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
//
// Achado real (usuário, 15/09/2026, segunda rodada): quando geolocalização
// ou o provedor de rotas falham, a primeira versão caía pra ordem planejada
// em SILÊNCIO — indistinguível de "a otimização não faz nada". `status`
// agora mostra pro técnico (e loga no console com detalhe) o que realmente
// aconteceu, em vez de um sucesso e uma falha parecerem a mesma coisa.
type Status =
  | { tipo: "ocioso" }
  | { tipo: "carregando" }
  | { tipo: "otimizada"; fonte: "provedor" | "linha_reta" }
  | { tipo: "ordem_planejada"; motivo: "sem_localizacao" | "erro" };

export function BotaoRotaOtimizada({
  paradas,
  linkPadrao,
}: {
  /** Uma por RT, na ordem planejada pelo gerente — também serve de fallback
   * se a geolocalização for negada ou o provedor de rotas falhar. */
  paradas: ParadaParaOtimizar[];
  linkPadrao: RotaNavegacao;
}) {
  const [status, setStatus] = useState<Status>({ tipo: "ocioso" });

  async function abrir() {
    if (status.tipo === "carregando") return;
    setStatus({ tipo: "carregando" });

    // A aba abre JÁ no clique, síncrona — chamar `window.open` depois de um
    // `await` (a geolocalização pode levar até 15s, ver lib/geolocalizacao.ts)
    // arrisca o navegador tratar como popup não solicitado e bloquear. Essa
    // aba em branco é redirecionada pro link final assim que ele estiver
    // pronto.
    const novaAba = window.open("", "_blank");
    try {
      novaAba?.document.write(
        '<title>Rota Inteligente</title><body style="font-family:sans-serif;color:#57534e;padding:2rem">Calculando a melhor rota…</body>',
      );
    } catch {
      // só cosmético — sem isso a aba fica em branco por alguns segundos, não é um problema real
    }

    let url = linkPadrao.url;
    let statusFinal: Status = { tipo: "ordem_planejada", motivo: "sem_localizacao" };

    try {
      // Ordem só importa com mais de 1 parada — poupa o técnico de um
      // pedido de permissão de localização à toa quando não muda nada.
      const origem = paradas.length > 1 ? await capturarGeolocalizacao() : null;

      if (!origem) {
        console.warn("[rota otimizada] geolocalização indisponível (negada, sem suporte, ou sem fix a tempo) — usando a ordem planejada.");
      } else {
        try {
          const resultado = await otimizarRotaDoDia(origem, paradas);
          const navegacaoOtimizada = linkGoogleMapsRota(resultado.paradas);
          if (navegacaoOtimizada) {
            url = navegacaoOtimizada.url;
            statusFinal = { tipo: "otimizada", fonte: resultado.fonte };
          } else {
            statusFinal = { tipo: "ordem_planejada", motivo: "erro" };
          }
        } catch (err) {
          // Server Action falhou (provedor fora do ar, erro de rede, etc.)
          // — loga com detalhe (achado real, 15/09/2026: um catch mudo aqui
          // deixava esse tipo de falha indistinguível de "tudo certo, só
          // que sem otimizar"). Segue com a ordem planejada de qualquer
          // forma — nunca trava o botão.
          console.error("[rota otimizada] falha ao calcular a ordem otimizada — usando a ordem planejada:", err);
          statusFinal = { tipo: "ordem_planejada", motivo: "erro" };
        }
      }

      if (novaAba && !novaAba.closed) novaAba.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setStatus(statusFinal);
    }
  }

  return (
    <div className="mb-3 flex flex-col gap-1">
      <button
        type="button"
        onClick={abrir}
        disabled={status.tipo === "carregando"}
        className={`flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-accent bg-accent/5 px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 disabled:cursor-wait disabled:opacity-70 ${FOCUS_RING}`}
      >
        <span aria-hidden="true">➤</span>
        {status.tipo === "carregando" ? "Calculando a melhor rota..." : "Abrir rota no Google Maps"}
      </button>

      {/* Visível de propósito (não só no console) — o técnico/quem testa
          precisa ver se a otimização de fato aconteceu ou se caiu pra
          ordem planejada, em vez de descobrir só abrindo o Maps. */}
      {status.tipo === "otimizada" && (
        <p className="text-xs text-sla-dentro">
          {status.fonte === "provedor"
            ? "✓ Rota otimizada por tempo real, a partir da sua localização."
            : "✓ Rota otimizada pela sua localização (distância em linha reta — sem tempo de carro configurado)."}
        </p>
      )}
      {status.tipo === "ordem_planejada" && (
        <p className="text-xs text-text-tertiary">
          {status.motivo === "sem_localizacao"
            ? "Sem acesso à sua localização — abrindo na ordem planejada pelo gerente."
            : "Não foi possível otimizar agora — abrindo na ordem planejada pelo gerente."}
        </p>
      )}
    </div>
  );
}
