"use server";

import { createClient } from "@/lib/supabase/server";

// Fase 5 (seção 12, migration 0038) — o app do técnico posta a posição
// enquanto está aberto. Erro é engolido de propósito: a posição é sinal
// auxiliar pra tela do gerente, não pode atrapalhar o técnico em campo.
// A RLS `tecnico_posicao_insert_own` é quem garante que só o próprio
// técnico grava a própria linha.
export async function registrarPosicao(input: {
  latitude: number;
  longitude: number;
  precisao: number | null;
}): Promise<void> {
  const { latitude, longitude, precisao } = input;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("tecnico_posicao").insert({
    tecnico_id: user.id,
    latitude,
    longitude,
    precisao_m: precisao,
  });
}
