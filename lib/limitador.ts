// Limitador de requisições por segundo, compartilhado.
//
// Generalizado a partir de lib/tomticket/limitador.ts (que por sua vez veio
// da `base-automatizacao`), quando o provedor de rotas passou a precisar do
// mesmo controle: o plano gratuito do OpenRouteService tem teto por minuto,
// e o servidor público do OSRM pede no máximo 1 req/s. Duplicar a fila era
// exatamente o tipo de repetição que este projeto vem consolidando.
//
// Fila encadeada em vez de "última chamada + sleep": duas chamadas
// concorrentes (dois gerentes clicando ao mesmo tempo) leriam o mesmo valor
// de `ultima` e passariam as duas.

export type Limitador = { aguardarVez: () => Promise<void> };

export function criarLimitador(reqPorSegundo: number): Limitador {
  const intervaloMs = Math.ceil(1000 / Math.max(reqPorSegundo, 0.001));
  let ultima = 0;
  let fila: Promise<void> = Promise.resolve();

  return {
    aguardarVez() {
      const proxima = fila.then(async () => {
        const falta = intervaloMs - (Date.now() - ultima);
        if (falta > 0) await new Promise((resolve) => setTimeout(resolve, falta));
        ultima = Date.now();
      });

      // A fila não pode quebrar se um item falhar — senão toda chamada
      // seguinte herdaria a rejeição e a integração morreria até o
      // servidor reiniciar.
      fila = proxima.catch(() => {});
      return proxima;
    },
  };
}
