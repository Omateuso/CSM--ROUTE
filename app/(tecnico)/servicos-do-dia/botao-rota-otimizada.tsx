"use client";

import { useState } from "react";
import { otimizarRotaDoDia, type ParadaParaOtimizar } from "./rota-actions";
import { capturarGeolocalizacao } from "@/lib/geolocalizacao";
import { linkAppleMapsRota, linkGoogleMapsRota, type RotaNavegacao } from "@/lib/navegacao";
import { useEhIOS } from "@/lib/ui/plataforma";
import { FOCUS_RING, PRIMARY_ACTION_BUTTON, SECONDARY_ACTION_BUTTON } from "@/lib/ui/styles";

// Rota do dia no app de mapas, em DUAS etapas (18/09/2026):
//
//   1. "Calcular a melhor rota" — pede a localização, chama o otimizador
//      (rota-actions.ts) e guarda a ordem final.
//   2. Links de verdade (<a href>) pro Google Maps e, no iPhone/iPad, pro
//      Apple Maps — o técnico toca e o app abre.
//
// Por que não é mais um botão só: a versão anterior abria uma aba em branco
// no clique e trocava a URL por JavaScript depois do `await`. No iOS um
// universal link (https://www.google.com/maps/…) só é entregue ao app do
// Google Maps quando a navegação é um toque direto num link; navegação por
// script cai na versão web, que no iPhone manda pra App Store — relato do
// usuário em 18/09 ("abre a App Store"). Era também a explicação mais
// provável do "abre na ordem planejada" investigado em 15/09: o link trocado
// por script nem sempre era o que o app recebia. Com a ordem já calculada, o
// link final existe ANTES do toque, e o toque é a navegação.
//
// Apple Maps entra porque nunca cai na loja (é nativo) — se o técnico não
// tem o Google Maps instalado, ainda assim navega.

type Status =
  | { tipo: "ocioso" }
  | { tipo: "carregando" }
  | { tipo: "otimizada"; fonte: "provedor" | "linha_reta"; rota: RotaNavegacao; apple: string | null }
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
  // Só decide QUAIS links mostrar (Apple Maps só no iPhone/iPad).
  const ios = useEhIOS();

  const applePadrao = linkAppleMapsRota(paradas.map((p) => p.endereco));

  async function calcular() {
    if (status.tipo === "carregando") return;
    if (paradas.length <= 1) {
      // Com uma parada só não há o que ordenar — os links da ordem planejada
      // já são a resposta.
      setStatus({ tipo: "ordem_planejada", motivo: "sem_localizacao" });
      return;
    }
    setStatus({ tipo: "carregando" });
    const origem = await capturarGeolocalizacao();
    if (!origem) {
      console.warn("[rota otimizada] geolocalização indisponível (negada, sem suporte, ou sem fix a tempo) — usando a ordem planejada.");
      setStatus({ tipo: "ordem_planejada", motivo: "sem_localizacao" });
      return;
    }
    try {
      const resultado = await otimizarRotaDoDia(origem, paradas);
      const enderecos = resultado.paradas.map((p) => p.endereco);
      const rota = linkGoogleMapsRota(enderecos);
      if (!rota) {
        setStatus({ tipo: "ordem_planejada", motivo: "erro" });
        return;
      }
      setStatus({ tipo: "otimizada", fonte: resultado.fonte, rota, apple: linkAppleMapsRota(enderecos) });
    } catch (err) {
      // Server Action falhou (provedor fora do ar, erro de rede, etc.) —
      // loga com detalhe (um catch mudo aqui deixava esse tipo de falha
      // indistinguível de "tudo certo, só que sem otimizar").
      console.error("[rota otimizada] falha ao calcular a ordem otimizada — usando a ordem planejada:", err);
      setStatus({ tipo: "ordem_planejada", motivo: "erro" });
    }
  }

  const otimizada = status.tipo === "otimizada" ? status : null;
  const urlGoogle = otimizada ? otimizada.rota.url : linkPadrao.url;
  const urlApple = otimizada ? otimizada.apple : applePadrao;
  const mostrarLinks = status.tipo === "otimizada" || status.tipo === "ordem_planejada";

  return (
    <div className="mb-3 flex flex-col gap-2">
      {!mostrarLinks && (
        <button
          type="button"
          onClick={calcular}
          disabled={status.tipo === "carregando"}
          className={`${SECONDARY_ACTION_BUTTON} border-accent text-accent disabled:cursor-wait`}
        >
          <IconeRota />
          {status.tipo === "carregando" ? "Calculando a melhor rota…" : "Calcular a melhor rota"}
        </button>
      )}

      {mostrarLinks && (
        <>
          <a href={urlGoogle} target="_blank" rel="noopener noreferrer" className={PRIMARY_ACTION_BUTTON}>
            <IconeRota />
            Abrir no Google Maps
          </a>
          {ios && urlApple && (
            <a href={urlApple} target="_blank" rel="noopener noreferrer" className={SECONDARY_ACTION_BUTTON}>
              Abrir no Apple Maps
            </a>
          )}
        </>
      )}

      {/* Visível de propósito (não só no console) — o técnico/quem testa
          precisa ver se a otimização de fato aconteceu ou se caiu pra
          ordem planejada. */}
      {status.tipo === "otimizada" && (
        <p className="text-xs text-sla-dentro">
          {status.fonte === "provedor"
            ? "✓ Ordem otimizada por tempo real, a partir da sua localização."
            : "✓ Ordem otimizada pela sua localização (distância em linha reta — sem tempo de carro configurado)."}
        </p>
      )}
      {status.tipo === "ordem_planejada" && (
        <p className="text-xs text-text-tertiary">
          {paradas.length <= 1
            ? "Uma parada só — abre direto no destino."
            : status.motivo === "sem_localizacao"
              ? "Sem acesso à sua localização — na ordem planejada pelo gerente."
              : "Não foi possível otimizar agora — na ordem planejada pelo gerente."}
          {paradas.length > 1 && (
            <>
              {" "}
              <button
                type="button"
                onClick={calcular}
                className={`font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}
              >
                Tentar de novo
              </button>
            </>
          )}
        </p>
      )}
      {status.tipo === "ocioso" && paradas.length > 1 && (
        <p className="text-xs text-text-tertiary">
          Ou{" "}
          <a href={linkPadrao.url} target="_blank" rel="noopener noreferrer" className={`font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
            abra na ordem planejada
          </a>
          {ios && applePadrao && (
            <>
              {" · "}
              <a href={applePadrao} target="_blank" rel="noopener noreferrer" className={`font-medium text-accent hover:text-accent-hover ${FOCUS_RING}`}>
                Apple Maps
              </a>
            </>
          )}
          .
        </p>
      )}
    </div>
  );
}

function IconeRota() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4 11 16-7-7 16-2-7z" />
    </svg>
  );
}
