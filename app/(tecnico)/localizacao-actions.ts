"use server";

import { createClient } from "@/lib/supabase/server";

// Localização estimada do técnico (migration 0057, 15/09/2026) — best-effort
// de propósito: quem chama (capturar-localizacao-inicial.tsx no mount, ou o
// botão "Atualizar localização estimada" em servicos-do-dia) decide o que
// fazer se isso falhar; nunca deve travar nada no app do técnico.
export async function atualizarLocalizacaoEstimada(
  latitude: number,
  longitude: number,
  precisaoM?: number | null,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_atualizar_localizacao_estimada", {
    p_latitude: latitude,
    p_longitude: longitude,
    p_precisao_m: precisaoM ?? null,
  });
  if (error) throw new Error(error.message);
}
