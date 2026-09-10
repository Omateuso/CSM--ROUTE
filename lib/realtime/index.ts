import { adaptadorSupabase } from "./supabase-adapter";
import type { AdaptadorRealtime } from "./tipos";

export type { AlvoRealtime, AdaptadorRealtime, Assinatura, EventoTabela, OpcoesAssinatura } from "./tipos";

// Ponto único de escolha do transporte de tempo real. Quando o servidor
// interno existir, é aqui que entra o adaptador de Socket.io — e só aqui.
export function adaptadorRealtime(): AdaptadorRealtime {
  return adaptadorSupabase;
}
