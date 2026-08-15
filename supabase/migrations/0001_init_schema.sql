-- =============================================================================
-- Plataforma de Gestão Operacional de Manutenção das RTs
-- Migration inicial — Fase 1 a 4 (schema completo; Fase 5 fica para migrations futuras)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSÕES
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
create type user_role          as enum ('gerente', 'tecnico', 'gestao');
create type prioridade_chamado as enum ('emergencial', 'alta', 'normal', 'baixa');
create type sla_status_tipo    as enum ('dentro', 'proximo', 'vencido');
create type status_chamado     as enum ('aberto', 'em_andamento', 'finalizado', 'cancelado');
create type status_rota        as enum ('planejada', 'confirmada', 'cancelada');
create type status_servico     as enum (
  'planejado',
  'em_deslocamento',
  'em_execucao',
  'concluido_tecnico',
  'aguardando_validacao',
  'validado'
);
create type tipo_evidencia     as enum ('foto', 'os', 'documento');

-- -----------------------------------------------------------------------------
-- ZONAS / REGIÕES  (ex.: Zona Oeste > Campo Grande)
-- -----------------------------------------------------------------------------
create table zonas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,          -- 'Zona Oeste', 'Zona Norte', 'Zona Sul'
  criado_em   timestamptz not null default now()
);

create table regioes (
  id          uuid primary key default gen_random_uuid(),
  zona_id     uuid not null references zonas(id) on delete restrict,
  nome        text not null,                  -- 'Campo Grande', 'Santa Cruz', 'Bangu'...
  criado_em   timestamptz not null default now(),
  unique (zona_id, nome)
);

-- -----------------------------------------------------------------------------
-- RTs (Residências Terapêuticas)
-- -----------------------------------------------------------------------------
create table rts (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,           -- 'RT 042'
  nome        text not null,                  -- opcional, ex. apelido da casa
  endereco    text not null,
  bairro      text not null,
  regiao_id   uuid not null references regioes(id) on delete restrict,
  latitude    numeric(9,6) not null,
  longitude   numeric(9,6) not null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_rts_regiao on rts (regiao_id);
create index idx_rts_lat_lng on rts (latitude, longitude);

-- -----------------------------------------------------------------------------
-- EQUIPES  (responsavel_id aponta para profiles, criado depois — FK adicionada no final)
-- -----------------------------------------------------------------------------
create table equipes (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,           -- 'Equipe 1'
  regiao_padrao_id   uuid references regioes(id) on delete set null,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- PROFILES  (estende auth.users do Supabase; técnicos e gerentes são profiles,
-- diferenciados pelo campo "role" — não há tabela "tecnicos" separada)
-- -----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  role        user_role not null default 'tecnico',
  telefone    text,
  equipe_id   uuid references equipes(id) on delete set null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create index idx_profiles_role on profiles (role);
create index idx_profiles_equipe on profiles (equipe_id);

-- agora que profiles existe, adiciona o responsável da equipe
alter table equipes
  add column responsavel_id uuid references profiles(id) on delete set null;

-- -----------------------------------------------------------------------------
-- SLA — regras por prioridade (prazo em horas)
-- -----------------------------------------------------------------------------
create table sla_regras (
  id              uuid primary key default gen_random_uuid(),
  prioridade      prioridade_chamado not null unique,
  prazo_horas     integer not null,           -- ex.: emergencial = 4h, alta = 24h...
  atualizado_em   timestamptz not null default now()
);

insert into sla_regras (prioridade, prazo_horas) values
  ('emergencial', 4),
  ('alta', 24),
  ('normal', 72),
  ('baixa', 168);

-- -----------------------------------------------------------------------------
-- CHAMADOS  (origem: TomTicket — tomticket_id fica pronto desde já para a
-- integração da Fase 5; na Fase 1 os chamados podem ser inseridos manualmente)
-- -----------------------------------------------------------------------------
create table chamados (
  id            uuid primary key default gen_random_uuid(),
  tomticket_id  text unique,                  -- id do chamado no TomTicket, quando sincronizado
  rt_id         uuid not null references rts(id) on delete restrict,
  assunto       text not null,
  descricao     text,
  prioridade    prioridade_chamado not null default 'normal',
  status        status_chamado not null default 'aberto',
  sla_prazo     timestamptz,                  -- calculado a partir de criado_em + sla_regras.prazo_horas
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_chamados_rt on chamados (rt_id);
create index idx_chamados_status on chamados (status);
create index idx_chamados_prioridade on chamados (prioridade);

-- status do SLA é derivado (dentro / próximo / vencido) — calculado em query/view,
-- não armazenado, para nunca ficar desatualizado:
create or replace function fn_sla_status(p_sla_prazo timestamptz)
returns sla_status_tipo
language sql immutable
as $$
  select case
    when p_sla_prazo is null then 'dentro'::sla_status_tipo
    when now() > p_sla_prazo then 'vencido'::sla_status_tipo
    when now() > (p_sla_prazo - interval '4 hours') then 'proximo'::sla_status_tipo
    else 'dentro'::sla_status_tipo
  end
$$;

-- trigger simples para preencher sla_prazo ao inserir um chamado
create or replace function fn_set_sla_prazo()
returns trigger language plpgsql as $$
declare
  v_prazo_horas integer;
begin
  select prazo_horas into v_prazo_horas from sla_regras where prioridade = new.prioridade;
  if v_prazo_horas is not null then
    new.sla_prazo := new.criado_em + make_interval(hours => v_prazo_horas);
  end if;
  return new;
end;
$$;

create trigger trg_chamados_sla
  before insert on chamados
  for each row execute function fn_set_sla_prazo();

-- -----------------------------------------------------------------------------
-- ROTAS  (planejamento diário) e ROTA_RTS (RTs incluídas, com ordem sugerida)
-- -----------------------------------------------------------------------------
create table rotas (
  id              uuid primary key default gen_random_uuid(),
  data            date not null,
  regiao_id       uuid not null references regioes(id) on delete restrict,
  equipe_id       uuid not null references equipes(id) on delete restrict,
  responsavel_id  uuid not null references profiles(id) on delete restrict, -- gerente que confirmou
  status          status_rota not null default 'planejada',
  confirmada_em   timestamptz,
  criado_em       timestamptz not null default now()
);

create index idx_rotas_data on rotas (data);
create index idx_rotas_regiao on rotas (regiao_id);

create table rota_rts (
  id        uuid primary key default gen_random_uuid(),
  rota_id   uuid not null references rotas(id) on delete cascade,
  rt_id     uuid not null references rts(id) on delete restrict,
  ordem     integer not null,                 -- posição sugerida/confirmada na rota
  unique (rota_id, rt_id)
);

-- -----------------------------------------------------------------------------
-- SERVIÇOS  (um serviço = um chamado sendo atendido dentro de uma rota,
-- por um técnico específico — é a entidade central do pipeline de execução)
-- -----------------------------------------------------------------------------
create table servicos (
  id              uuid primary key default gen_random_uuid(),
  rota_id         uuid not null references rotas(id) on delete restrict,
  chamado_id      uuid not null references chamados(id) on delete restrict,
  rt_id           uuid not null references rts(id) on delete restrict,
  tecnico_id      uuid references profiles(id) on delete set null,
  status          status_servico not null default 'planejado',
  iniciado_em     timestamptz,
  concluido_em    timestamptz,
  criado_em       timestamptz not null default now()
);

create index idx_servicos_rota on servicos (rota_id);
create index idx_servicos_tecnico on servicos (tecnico_id);
create index idx_servicos_status on servicos (status);

-- -----------------------------------------------------------------------------
-- EXECUÇÕES — linha do tempo de início/fim do atendimento em campo
-- -----------------------------------------------------------------------------
create table execucoes (
  id            uuid primary key default gen_random_uuid(),
  servico_id    uuid not null references servicos(id) on delete cascade,
  iniciado_em   timestamptz not null default now(),
  concluido_em  timestamptz,
  observacao    text
);

-- -----------------------------------------------------------------------------
-- CONCLUSÕES — reaproveita o conceito de "chamado_conclusoes" do projeto
-- anterior: registro específico da conclusão informada pelo técnico.
-- -----------------------------------------------------------------------------
create table conclusoes (
  id            uuid primary key default gen_random_uuid(),
  servico_id    uuid not null references servicos(id) on delete cascade,
  chamado_id    uuid not null references chamados(id) on delete restrict,
  equipe_id     uuid references equipes(id) on delete set null,
  tecnico_id    uuid not null references profiles(id) on delete restrict,
  observacao    text not null,
  concluido_em  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- EVIDÊNCIAS — fotos, OS digitalizada, documentos (arquivo fica no Supabase
-- Storage; aqui guardamos só a referência)
-- -----------------------------------------------------------------------------
create table evidencias (
  id            uuid primary key default gen_random_uuid(),
  servico_id    uuid not null references servicos(id) on delete cascade,
  tipo          tipo_evidencia not null,
  storage_path  text not null,                -- caminho no bucket do Supabase Storage
  criado_em     timestamptz not null default now(),
  criado_por    uuid references profiles(id) on delete set null
);

-- -----------------------------------------------------------------------------
-- VALIDAÇÕES — conferência do gerente sobre o serviço concluído pelo técnico
-- -----------------------------------------------------------------------------
create table validacoes (
  id            uuid primary key default gen_random_uuid(),
  servico_id    uuid not null references servicos(id) on delete cascade,
  validado_por  uuid not null references profiles(id) on delete restrict,
  validado_em   timestamptz not null default now(),
  observacao    text
);

-- -----------------------------------------------------------------------------
-- HISTÓRICO — linha do tempo do chamado (rastreabilidade completa)
-- -----------------------------------------------------------------------------
create table historico (
  id          uuid primary key default gen_random_uuid(),
  chamado_id  uuid not null references chamados(id) on delete cascade,
  evento      text not null,                  -- ex.: 'rota_confirmada', 'servico_iniciado', 'evidencia_anexada'
  descricao   text,
  criado_em   timestamptz not null default now(),
  criado_por  uuid references profiles(id) on delete set null
);

create index idx_historico_chamado on historico (chamado_id, criado_em);

-- -----------------------------------------------------------------------------
-- FUNÇÃO AUXILIAR — distância Haversine (km) entre duas RTs, usada pelo
-- algoritmo de sugestão de rota (Fase 2)
-- -----------------------------------------------------------------------------
create or replace function fn_haversine_km(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) returns numeric
language sql immutable
as $$
  select 6371 * 2 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) *
      power(sin(radians(lon2 - lon1) / 2), 2)
    )
  )
$$;

-- -----------------------------------------------------------------------------
-- VIEW — relatório operacional do dia (on-demand; se precisar de histórico
-- persistido por dia, criar tabela relatorios_diarios na Fase 5)
-- -----------------------------------------------------------------------------
-- nota: "total_planejados" conta todos os serviços da rota do dia (equivalente
-- a "18 serviços planejados" no exemplo do briefing), não apenas os que ainda
-- estão com status = 'planejado' — esse é o total agendado para o dia.
create or replace view vw_relatorio_diario as
select
  r.data,
  r.regiao_id,
  reg.nome as regiao_nome,
  count(s.id) filter (where s.status is not null)                as total_planejados,
  count(s.id) filter (where s.status = 'validado')                as total_concluidos,
  count(s.id) filter (where s.status in ('em_execucao','em_deslocamento')) as total_em_execucao,
  count(s.id) filter (where s.status = 'planejado')               as total_nao_iniciados
from rotas r
join regioes reg on reg.id = r.regiao_id
left join servicos s on s.rota_id = r.id
group by r.data, r.regiao_id, reg.nome;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) — ponto de partida; refinar por tela conforme a
-- Fase 3/4 avançarem. Todas as tabelas de negócio ficam com RLS habilitado.
-- =============================================================================
alter table profiles   enable row level security;
alter table rts        enable row level security;
alter table chamados   enable row level security;
alter table rotas      enable row level security;
alter table rota_rts   enable row level security;
alter table servicos   enable row level security;
alter table execucoes  enable row level security;
alter table conclusoes enable row level security;
alter table evidencias enable row level security;
alter table validacoes enable row level security;
alter table historico  enable row level security;

-- helper: role do usuário logado
create or replace function fn_current_role()
returns user_role
language sql stable
as $$
  select role from profiles where id = auth.uid()
$$;

-- profiles: usuário vê o próprio perfil; gerente/gestão veem todos
create policy "profiles_select_own_or_management"
  on profiles for select
  using (id = auth.uid() or fn_current_role() in ('gerente','gestao'));

-- leitura geral (RTs, chamados, rotas...) liberada para qualquer usuário autenticado —
-- o técnico só precisa filtrar na aplicação o que é "dele"; granularidade fina
-- (ex.: técnico só edita o próprio serviço) fica nas policies de update abaixo.
create policy "rts_select_authenticated"      on rts      for select using (auth.role() = 'authenticated');
create policy "chamados_select_authenticated" on chamados for select using (auth.role() = 'authenticated');
create policy "rotas_select_authenticated"    on rotas    for select using (auth.role() = 'authenticated');
create policy "rota_rts_select_authenticated" on rota_rts for select using (auth.role() = 'authenticated');
create policy "historico_select_authenticated" on historico for select using (auth.role() = 'authenticated');

-- serviços: técnico só enxerga/edita os que são dele; gerente/gestão veem tudo
create policy "servicos_select"
  on servicos for select
  using (tecnico_id = auth.uid() or fn_current_role() in ('gerente','gestao'));

create policy "servicos_update_own_or_management"
  on servicos for update
  using (tecnico_id = auth.uid() or fn_current_role() in ('gerente','gestao'));

-- execuções/conclusões/evidências: técnico só insere/vê as do próprio serviço
create policy "execucoes_select"
  on execucoes for select
  using (exists (
    select 1 from servicos s
    where s.id = execucoes.servico_id
      and (s.tecnico_id = auth.uid() or fn_current_role() in ('gerente','gestao'))
  ));

create policy "conclusoes_select"
  on conclusoes for select
  using (tecnico_id = auth.uid() or fn_current_role() in ('gerente','gestao'));

create policy "conclusoes_insert_own"
  on conclusoes for insert
  with check (tecnico_id = auth.uid());

create policy "evidencias_select"
  on evidencias for select
  using (exists (
    select 1 from servicos s
    where s.id = evidencias.servico_id
      and (s.tecnico_id = auth.uid() or fn_current_role() in ('gerente','gestao'))
  ));

-- validações: só gerente/gestão inserem
create policy "validacoes_insert_management"
  on validacoes for insert
  with check (fn_current_role() in ('gerente','gestao'));

create policy "validacoes_select_authenticated"
  on validacoes for select using (auth.role() = 'authenticated');