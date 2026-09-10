import { criarLimitador } from "@/lib/limitador";
import { TOMTICKET_REQ_POR_SEGUNDO } from "./config";

// Segura as chamadas pra não passar de 3 por segundo (limite documentado).
//
// A mecânica da fila vive em lib/limitador.ts desde 10/09/2026 — o provedor
// de rotas (ORS/OSRM) precisava do mesmo controle e duplicar a fila não
// fazia sentido. O motivo original continua valendo e está registrado lá:
// passar do limite do TomTicket NÃO devolve erro, enfileira; e uma resposta
// com 3 anexos dispara 3 requisições, que sem isto saem juntas.
const limitador = criarLimitador(TOMTICKET_REQ_POR_SEGUNDO);

export function aguardarVez(): Promise<void> {
  return limitador.aguardarVez();
}
