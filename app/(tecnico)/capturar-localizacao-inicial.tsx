"use client";

import { useEffect, useRef } from "react";
import { capturarGeolocalizacao } from "@/lib/geolocalizacao";
import { atualizarLocalizacaoEstimada } from "./localizacao-actions";

// Localização ESTIMADA do técnico (migration 0057, 15/09/2026) — captura 1x
// quando o app abre, NUNCA em loop (diferente do posicao-reporter.tsx
// removido na migration 0041, que reportava a cada 30s enquanto a tela
// ficava aberta — virou "ruído que lê como fiscalização", ver o cabeçalho
// daquela migration). Aqui é só um ping na abertura + o botão "Atualizar
// localização estimada" (servicos-do-dia), sob controle do próprio técnico.
//
// Best-effort completo: geolocalização negada/indisponível ou falha ao
// gravar nunca aparecem pro técnico — essa tela nunca teve "sinal de
// suspeita" nenhum pro técnico ver (mesmo princípio de camera-capture-field.tsx).
export function CapturarLocalizacaoInicial() {
  const jaTentou = useRef(false);

  useEffect(() => {
    if (jaTentou.current) return;
    jaTentou.current = true;

    void (async () => {
      const geo = await capturarGeolocalizacao();
      if (!geo) return;
      try {
        await atualizarLocalizacaoEstimada(geo.lat, geo.lng);
      } catch {
        // best-effort — falha aqui nunca deve incomodar o técnico
      }
    })();
  }, []);

  return null;
}
