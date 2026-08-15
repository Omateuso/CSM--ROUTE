-- =============================================================================
-- Fase 1 — Base Operacional
-- Histórico de endereço das RTs.
--
-- Contexto: o código da RT (ex. "SRT 16") é a identidade permanente —
-- chamados.rt_id já aponta pra essa identidade desde a 0001, não pro
-- endereço, e é isso que evita perder o histórico de chamados quando uma
-- RT muda de imóvel. O que faltava era não perder o histórico do
-- ENDEREÇO em si: ao importar os dados reais (Parte B), 3 RTs (SRT 16,
-- 19, 44) já tinham endereço antigo e novo registrados no mesmo arquivo.
--
-- rt_enderecos é o log append-only de todo endereço que uma RT já teve.
-- As colunas de endereço/bairro/regiao_id/latitude/longitude que
-- continuam em `rts` são mantidas de propósito (não removidas) — o
-- dashboard e o mapa da Fase 1 continuam lendo direto de `rts`, sem
-- precisar de join. `rt_enderecos` é a fonte da verdade histórica;
-- `rts` é sempre uma cópia sincronizada do endereço vigente.
-- =============================================================================

create table rt_enderecos (
  id              uuid primary key default gen_random_uuid(),
  rt_id           uuid not null references rts(id) on delete cascade,
  endereco        text not null,
  bairro          text not null,
  regiao_id       uuid not null references regioes(id) on delete restrict,
  latitude        numeric(9,6) not null,
  longitude       numeric(9,6) not null,
  vigente_desde   date not null default current_date,
  vigente_ate     date,                        -- null = é o endereço atual
  motivo          text,
  criado_em       timestamptz not null default now(),
  criado_por      uuid references profiles(id) on delete set null
);

create index idx_rt_enderecos_rt on rt_enderecos (rt_id, vigente_desde);

-- garante no máximo 1 endereço vigente (vigente_ate is null) por RT
create unique index idx_rt_enderecos_vigente_unico
  on rt_enderecos (rt_id)
  where vigente_ate is null;

alter table rt_enderecos enable row level security;

create policy "rt_enderecos_select_authenticated" on rt_enderecos
  for select to authenticated using (true);

create policy "rt_enderecos_insert_gerente" on rt_enderecos
  for insert to authenticated with check (fn_current_role() = 'gerente');

create policy "rt_enderecos_update_gerente" on rt_enderecos
  for update to authenticated
  using (fn_current_role() = 'gerente')
  with check (fn_current_role() = 'gerente');

-- sem policy de delete: histórico é append-only, igual ao resto do schema
-- (rts/chamados também não têm delete — ver 0002).

-- -----------------------------------------------------------------------------
-- fn_trocar_endereco_rt — único jeito suportado de mudar o endereço de uma
-- RT. Fecha o vigente atual, abre o novo, e sincroniza as colunas
-- espelhadas em `rts`. A aplicação nunca deve fazer UPDATE direto nas
-- colunas endereco/bairro/regiao_id/latitude/longitude de `rts` —
-- só através desta função (ver CLAUDE.md).
--
-- RLS de rt_enderecos e rts já restringe insert/update a 'gerente';
-- roda como security invoker (padrão) de propósito, pra herdar essa
-- mesma checagem sem duplicar a regra dentro da função.
-- -----------------------------------------------------------------------------
create or replace function fn_trocar_endereco_rt(
  p_rt_id         uuid,
  p_endereco      text,
  p_bairro        text,
  p_regiao_id     uuid,
  p_latitude      numeric,
  p_longitude     numeric,
  p_motivo        text default null,
  p_vigente_desde date default current_date
) returns uuid
language plpgsql
as $$
declare
  v_novo_id uuid;
begin
  update rt_enderecos
    set vigente_ate = p_vigente_desde
    where rt_id = p_rt_id and vigente_ate is null;

  insert into rt_enderecos (
    rt_id, endereco, bairro, regiao_id, latitude, longitude,
    vigente_desde, vigente_ate, motivo, criado_por
  ) values (
    p_rt_id, p_endereco, p_bairro, p_regiao_id, p_latitude, p_longitude,
    p_vigente_desde, null, p_motivo, auth.uid()
  )
  returning id into v_novo_id;

  update rts
    set endereco      = p_endereco,
        bairro        = p_bairro,
        regiao_id     = p_regiao_id,
        latitude      = p_latitude,
        longitude     = p_longitude,
        atualizado_em = now()
    where id = p_rt_id;

  return v_novo_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- fn_criar_rt_com_endereco — único jeito suportado de criar uma RT nova.
-- Garante que toda RT nasce já com sua primeira linha em rt_enderecos —
-- sem isso, uma RT criada depois desta migration ficaria sem histórico
-- até a primeira troca de endereço, quebrando a garantia de que
-- rt_enderecos é sempre a lista completa de endereços de cada RT.
-- -----------------------------------------------------------------------------
create or replace function fn_criar_rt_com_endereco(
  p_codigo    text,
  p_nome      text,
  p_endereco  text,
  p_bairro    text,
  p_regiao_id uuid,
  p_latitude  numeric,
  p_longitude numeric,
  p_ativo     boolean default true
) returns uuid
language plpgsql
as $$
declare
  v_rt_id uuid;
begin
  insert into rts (codigo, nome, endereco, bairro, regiao_id, latitude, longitude, ativo)
  values (p_codigo, p_nome, p_endereco, p_bairro, p_regiao_id, p_latitude, p_longitude, p_ativo)
  returning id into v_rt_id;

  insert into rt_enderecos (
    rt_id, endereco, bairro, regiao_id, latitude, longitude,
    vigente_desde, vigente_ate, motivo, criado_por
  ) values (
    v_rt_id, p_endereco, p_bairro, p_regiao_id, p_latitude, p_longitude,
    current_date, null, 'Cadastro inicial da RT', auth.uid()
  );

  return v_rt_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Backfill idempotente: toda RT que já existir na tabela `rts` no momento
-- em que esta migration rodar ganha o endereço atual como primeiro item
-- do histórico (vigente_desde = data de criação da RT, já que não temos
-- informação melhor pra essas). Reexecutar esta migration não duplica —
-- só insere pra RTs que ainda não têm nenhuma linha em rt_enderecos.
-- -----------------------------------------------------------------------------
insert into rt_enderecos (rt_id, endereco, bairro, regiao_id, latitude, longitude, vigente_desde, vigente_ate, motivo)
select
  r.id, r.endereco, r.bairro, r.regiao_id, r.latitude, r.longitude,
  r.criado_em::date, null, 'Backfill — endereço registrado na migration 0005'
from rts r
where not exists (
  select 1 from rt_enderecos re where re.rt_id = r.id
);
