"use client";

import { useEffect, useRef } from "react";
import { registrarPosicao } from "./posicao-actions";

// Fase 5 (seção 12) — captura a posição do técnico enquanto o app está
// aberto e em foco, e manda pro servidor. Automático: reusa a permissão de
// geolocalização que a foto carimbada (0023) já pede; sem botão de
// ligar/desligar (decisão do usuário). Silencioso — se o técnico negar a
// permissão, nada acontece e ele não vê nem sabe.
//
// PWA não roda GPS em segundo plano (iOS mata os timers quando a aba perde
// o foco), então o `tick` só age com `visibilityState === "visible"`.
//
// Poupa o banco quando o técnico está parado numa RT: só manda um ping novo
// se moveu mais que MOVEU_M ou se já passou HEARTBEAT_MS desde o último
// envio (mantém um batimento mesmo parado).

const INTERVALO_MS = 30_000;
const HEARTBEAT_MS = 3 * 60_000;
const MOVEU_M = 20;

function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

export function PosicaoReporter() {
  const ultimoEnvio = useRef<{ lat: number; lng: number; t: number } | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    let vivo = true;

    function tick() {
      if (!vivo || document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!vivo) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const agora = Date.now();
          const prev = ultimoEnvio.current;
          if (prev) {
            const parado = distanciaM({ lat: prev.lat, lng: prev.lng }, { lat, lng }) < MOVEU_M;
            const recente = agora - prev.t < HEARTBEAT_MS;
            if (parado && recente) return;
          }
          ultimoEnvio.current = { lat, lng, t: agora };
          void registrarPosicao({
            latitude: lat,
            longitude: lng,
            precisao: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
      );
    }

    const timer = setInterval(tick, INTERVALO_MS);
    tick();

    return () => {
      vivo = false;
      clearInterval(timer);
    };
  }, []);

  return null;
}
