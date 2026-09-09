-- =============================================================================
-- Evolução para plataforma operacional — Fase 5 (seção 12), 09/09/2026
--
-- "Rota do dia ao vivo." A tela nova `app/rotas/hoje` (gerente + gestão)
-- mostra as rotas confirmadas de hoje num mapa: cada parada colorida pelo
-- status do serviço (que já vem ao vivo via Realtime desde a 0019), o pin
-- do técnico na última posição, e a trilha do dia (polyline).
--
-- Decisões de produto (confirmadas com o usuário via AskUserQuestion):
--   - GPS do técnico ENTRA — posição capturada automaticamente enquanto o
--     app do técnico está aberto e em foco (reusa a permissão de
--     geolocalização que já é pedida pra foto carimbada da 0023). Sem
--     botão de opt-in — decisão explícita do usuário.
--   - TRILHA do dia: uma linha por ping (não upsert de "última posição").
--   - A tela é igual pra gerente e gestão.
--
-- Limitação técnica conhecida (não é bug): um PWA não posta GPS em segundo
-- plano — iOS mata os timers de JS quando a aba perde o foco. "Ao vivo" =
-- enquanto o técnico está com a tela do app aberta e ligada.
--
-- Privacidade: o CLAUDE.md é enfático que o sistema "não é ferramenta de
-- controle/punição do prestador". Por isso: (1) só gerente/gestão leem,
-- nunca outro técnico; (2) sem update/delete pra `authenticated` — a
-- trilha é append-only e nem o próprio técnico reescreve; (3) expurgo
-- automático de 7 dias (fn_expurgar_posicoes, chamada pelo coletor).
-- =============================================================================

create table tecnico_posicao (
  id           uuid primary key default gen_random_uuid(),
  tecnico_id   uuid not null references profiles(id) on delete cascade,
  latitude     numeric(9,6) not null,
  longitude    numeric(9,6) not null,
  precisao_m   numeric,                       -- accuracy em metros (Geolocation API), nullable
  capturado_em timestamptz not null default now()
);

create index idx_tecnico_posicao_tecnico on tecnico_posicao (tecnico_id, capturado_em desc);
create index idx_tecnico_posicao_capturado on tecnico_posicao (capturado_em);

alter table tecnico_posicao enable row level security;

-- INSERT: só o próprio técnico grava a própria posição.
create policy "tecnico_posicao_insert_own" on tecnico_posicao for insert
  to authenticated with check (
    tecnico_id = auth.uid() and fn_current_role() = 'tecnico'
  );

-- SELECT: gerente/gestão (a tela ao vivo) ou o próprio técnico. Nunca um
-- técnico vê a posição de outro.
create policy "tecnico_posicao_select" on tecnico_posicao for select
  to authenticated using (
    fn_current_role() in ('gerente', 'gestao') or tecnico_id = auth.uid()
  );

-- Sem UPDATE/DELETE pra authenticated de propósito (append-only). O expurgo
-- roda com service role, pela função abaixo.

-- Realtime: a tela ao vivo assina os inserts.
alter table tecnico_posicao replica identity full;
alter publication supabase_realtime add table tecnico_posicao;

-- -----------------------------------------------------------------------------
-- fn_expurgar_posicoes — apaga pings mais velhos que N dias. `security
-- invoker`: rodando como service role (coletor/instrumentation.ts) bypassa
-- a RLS e apaga; rodando como um usuário comum, a RLS sem policy de DELETE
-- não deixa apagar nada. É a política de retenção documentada em SQL.
-- -----------------------------------------------------------------------------
create or replace function fn_expurgar_posicoes(p_dias integer default 7)
returns integer
language plpgsql
as $$
declare
  v_apagadas integer;
begin
  delete from tecnico_posicao
  where capturado_em < now() - make_interval(days => greatest(p_dias, 1));
  get diagnostics v_apagadas = row_count;
  return v_apagadas;
end;
$$;
