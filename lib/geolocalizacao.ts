export type GeoCoords = { lat: number; lng: number };

// Extraído de app/(tecnico)/servico/[id]/camera-capture-field.tsx
// (15/09/2026) pra ser reaproveitado também pelo botão de rota otimizada
// (servicos-do-dia-lista.tsx) — mesma lógica, um lugar só.
function pedirPosicao(opcoes: PositionOptions): Promise<GeoCoords | null> {
  return new Promise((resolve) => {
    let resolvido = false;
    const finalizar = (valor: GeoCoords | null) => {
      if (resolvido) return;
      resolvido = true;
      resolve(valor);
    };
    // Timeout próprio como rede de segurança, além da opção `timeout` da
    // própria API.
    const timeoutId = setTimeout(() => finalizar(null), opcoes.timeout ?? 10000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeoutId);
        finalizar({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timeoutId);
        finalizar(null);
      },
      opcoes,
    );
  });
}

// 2 tentativas (15/09/2026, ajuste — achado real testando a rota otimizada
// do técnico): `enableHighAccuracy:true` força o chip de GPS, que pode não
// fechar um "fix" nos 8s originais (GPS frio, sem sinal recente, prédio
// perto de uma RT) — permissão concedida, mas a posição nunca chegava a
// tempo, e quem chama (botao-rota-otimizada.tsx) caía silenciosamente pra
// ordem planejada, parecendo que a otimização "não funciona". Se a 1ª
// tentativa (alta precisão, 10s) estourar o prazo, uma 2ª tentativa com
// precisão de rede (bem mais rápida — wifi/torre, ~1km de erro, mas ainda
// útil pra saber de que lado da rota o técnico está) tenta antes de
// desistir de vez. GPS indoor nas RTs falha com frequência — travar o
// técnico esperando geolocalização não é aceitável (mesma decisão já
// confirmada com o usuário pra foto carimbada: sem localização não bloqueia
// a ação).
export async function capturarGeolocalizacao(): Promise<GeoCoords | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return null;

  const precisa = await pedirPosicao({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  if (precisa) return precisa;

  return pedirPosicao({ enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 });
}
