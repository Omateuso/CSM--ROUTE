-- =============================================================================
-- Localização ESTIMADA do técnico (pedido do usuário, 15/09/2026) — "para o
-- gerente decidir a pessoa que mais está próxima do lugar para realizar um
-- chamado emergencial, entre outras coisas que precisariam disso".
--
-- DIFERENÇA DELIBERADA em relação à `tecnico_posicao` (rastreamento ao vivo
-- REMOVIDO na migration 0041, por virar "ruído que lê como fiscalização" —
-- ver o cabeçalho daquela migration e da 0038 que ela reverteu): aqui é
-- **1 linha por técnico**, sobrescrita (upsert) — não uma trilha contínua
-- de pings a cada 30s. E a captura NUNCA é automática em loop: acontece 1x
-- quando o técnico abre o app (client component simples, sem
-- `setInterval`) + sob demanda, quando ele mesmo toca em "Atualizar
-- localização estimada". Decisão confirmada com o usuário: sem serviço
-- concluído hoje, a estimativa vem desse ping de abertura — não existe
-- "sem localização nenhuma" só porque o técnico ainda não terminou nada.
--
-- Se uma sessão futura encontrar esta migration e a `0041` no histórico e
-- imaginar que o rastreamento ao vivo "voltou": NÃO voltou — o modelo de
-- dado é propositalmente mais pobre (posição atual, não trilha), e a
-- captura é iniciada pelo técnico, nunca silenciosa em segundo plano.
-- =============================================================================

create table tecnico_localizacao_estimada (
  tecnico_id   uuid primary key references profiles(id) on delete cascade,
  latitude     numeric(9,6) not null,
  longitude    numeric(9,6) not null,
  precisao_m   numeric,
  atualizado_em timestamptz not null default now()
);

alter table tecnico_localizacao_estimada enable row level security;

-- INSERT/UPDATE: só o próprio técnico grava/atualiza a própria linha —
-- necessário os dois pro `insert ... on conflict (tecnico_id) do update`
-- de `fn_atualizar_localizacao_estimada` funcionar (o primeiro ping de um
-- técnico passa pelo INSERT; os seguintes, pelo UPDATE do conflito).
create policy "tecnico_localizacao_insert_own" on tecnico_localizacao_estimada for insert
  to authenticated with check (
    tecnico_id = auth.uid() and fn_current_role() = 'tecnico'
  );

create policy "tecnico_localizacao_update_own" on tecnico_localizacao_estimada for update
  to authenticated using (tecnico_id = auth.uid() and fn_current_role() = 'tecnico')
  with check (tecnico_id = auth.uid() and fn_current_role() = 'tecnico');

-- SELECT: gerente/gestão (decidir despacho) ou o próprio técnico. Nunca um
-- técnico vê a localização de outro.
create policy "tecnico_localizacao_select" on tecnico_localizacao_estimada for select
  to authenticated using (
    fn_current_role() in ('gerente', 'gestao') or tecnico_id = auth.uid()
  );

-- Sem policy de DELETE pra `authenticated` de propósito — a linha só é
-- sobrescrita (upsert), nunca precisa ser removida em uso normal.

create or replace function fn_atualizar_localizacao_estimada(
  p_latitude   numeric,
  p_longitude  numeric,
  p_precisao_m numeric default null
) returns void
language plpgsql
security invoker
as $$
begin
  if fn_current_role() <> 'tecnico' then
    raise exception 'Só o técnico atualiza a própria localização estimada.';
  end if;
  if p_latitude is null or p_longitude is null then
    raise exception 'Localização inválida.';
  end if;

  insert into tecnico_localizacao_estimada (tecnico_id, latitude, longitude, precisao_m, atualizado_em)
  values (auth.uid(), p_latitude, p_longitude, p_precisao_m, now())
  on conflict (tecnico_id) do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    precisao_m = excluded.precisao_m,
    atualizado_em = now();
end;
$$;
