import { TOMTICKET_REQ_POR_SEGUNDO } from "./config";

// Segura as chamadas pra não passar de 3 por segundo (limite documentado).
//
// Portado da `base-automatizacao` (base/tomticket_api.py, classe `Limitador`),
// que é explícita sobre o motivo: passar do limite NÃO devolve erro, enfileira.
// Uma resposta com 3 anexos dispara 3 requisições (resolver id, reler, enviar);
// sem isto elas saem juntas e a lentidão aparece sem explicação.
//
// Fila encadeada em vez de um simples "última chamada + sleep": requisições
// concorrentes (dois gerentes clicando ao mesmo tempo) leriam o mesmo valor de
// `ultima` e passariam as duas.

const INTERVALO_MS = Math.ceil(1000 / TOMTICKET_REQ_POR_SEGUNDO);

let ultima = 0;
let fila: Promise<void> = Promise.resolve();

export function aguardarVez(): Promise<void> {
  const proxima = fila.then(async () => {
    const falta = INTERVALO_MS - (Date.now() - ultima);
    if (falta > 0) await new Promise((resolve) => setTimeout(resolve, falta));
    ultima = Date.now();
  });

  // A fila não pode quebrar se um item falhar — senão toda chamada seguinte
  // herdaria a rejeição e a integração morreria até o servidor reiniciar.
  fila = proxima.catch(() => {});
  return proxima;
}
