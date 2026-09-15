export type GeoCoords = { lat: number; lng: number };

// Extraído de app/(tecnico)/servico/[id]/camera-capture-field.tsx
// (15/09/2026) pra ser reaproveitado também pelo botão de rota otimizada
// (servicos-do-dia-lista.tsx) — mesma lógica, um lugar só.
export function capturarGeolocalizacao(): Promise<GeoCoords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    let resolvido = false;
    const finalizar = (valor: GeoCoords | null) => {
      if (resolvido) return;
      resolvido = true;
      resolve(valor);
    };
    // Timeout próprio como rede de segurança, além da opção `timeout` da
    // própria API — GPS indoor nas RTs falha com frequência, e travar o
    // técnico esperando geolocalização não é aceitável (mesma decisão já
    // confirmada com o usuário pra foto carimbada: sem localização não
    // bloqueia a ação).
    const timeoutId = setTimeout(() => finalizar(null), 8000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeoutId);
        finalizar({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timeoutId);
        finalizar(null);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}
