-- =============================================================================
-- Central de Urgências (04/09/2026)
--
-- Resolve um caso que não existia no sistema: uma necessidade excepcional
-- chega por WhatsApp ANTES de qualquer `chamado` existir, e precisa de
-- resposta rápida sem esperar o próximo ciclo normal de Montar Rota.
--
-- Decisões de arquitetura (plano aprovado pelo usuário em 04/09/2026):
--   1. Tabela `urgencias` nova, com ciclo de vida próprio nos estágios
--      anteriores ao chamado existir (solicitada -> em_analise -> validada
--      -> em_atendimento). Na decisão de atendimento, gera um `chamados`
--      real (tomticket_id nulo se ainda não houver protocolo) — a partir daí
--      o `servico` nasce normal e reaproveita 100% do pipeline de execução
--      já existente (fn_iniciar_servico/fn_concluir_servico/etc., nenhuma
--      mudada aqui). "Concluída" não é um valor armazenado — é derivado, na
--      leitura, do status do `servico` vinculado (evita duas fontes de
--      verdade).
--   2. Só `gerente` opera (registra/analisa/valida/decide); `gestão` só lê
--      (mesmo padrão do resto do sistema — nenhuma policy de escrita pra
--      gestão aqui).
--   3. "Rota confirmada é histórico imutável" (0011, reforçada em 0016/0022)
--      continua valendo: nenhuma policy de UPDATE/DELETE nova em
--      `rotas`/`rota_rts`. Achado de arquitetura: a policy de INSERT em
--      `rota_rts` (0011) já permite inserir uma parada nova numa rota já
--      confirmada — o que faltava era uma função séria pra fazer isso
--      direito (ordem, serviço, histórico), não uma policy nova. A parada da
--      urgência é sempre ANEXADA ao fim das paradas daquela rota
--      (`ordem = max(ordem)+1`) — nunca renumera as existentes. "Inserir
--      entre C e D" vira recomendação textual + impacto estimado (km/min),
--      não uma reordenação física.
--   4. `historico.chamado_id` vira nullable + `historico.urgencia_id` novo
--      (em vez de criar uma tabela de timeline paralela) — a mesma
--      `HistoricoChamado` (lib/ui/historico-chamado.tsx) passa a combinar
--      eventos pré-chamado (por urgencia_id) e pós-chamado (por chamado_id)
--      numa timeline só. Nenhum ponto de escrita existente precisa mudar
--      (todos já gravam chamado_id sempre).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabela `urgencias`
-- -----------------------------------------------------------------------------
create table urgencias (
  id                       uuid primary key default gen_random_uuid(),
  codigo                   text not null unique,              -- 'URG-2026-001'
  rt_id                    uuid not null references rts(id) on delete restrict,
  chamado_id               uuid references chamados(id) on delete set null,
  descricao                text not null,
  motivo                   text not null,
  solicitante              text not null,                     -- quem relatou no WhatsApp
  anexo_path               text,                               -- bucket urgencias-anexos
  prioridade               prioridade_chamado,                 -- só fica certa na validação
  status                   text not null default 'solicitada'
                             check (status in (
                               'solicitada', 'em_analise', 'validada',
                               'nao_validada', 'em_atendimento', 'cancelada'
                             )),
  motivo_nao_validada      text,
  motivo_cancelamento      text,
  atendida_por_servico_id  uuid references servicos(id) on delete set null,
  opcao_escolhida          text
                             check (opcao_escolhida in ('insercao_rota', 'fim_de_rota', 'outra_equipe', 'avulsa')),
  equipe_escolhida_id      uuid references equipes(id) on delete set null,
  impacto_km               numeric(6,2),
  impacto_min              integer,
  criado_por               uuid not null references profiles(id) on delete restrict,
  criado_em                timestamptz not null default now(),
  analisado_em             timestamptz,
  validado_por             uuid references profiles(id) on delete set null,
  validado_em              timestamptz
);

create index idx_urgencias_status   on urgencias (status);
create index idx_urgencias_rt       on urgencias (rt_id);
create index idx_urgencias_chamado  on urgencias (chamado_id);

alter table urgencias enable row level security;

-- select liberado pra qualquer autenticado (mesmo padrão do resto do
-- schema) — gestão enxerga tudo, a UI dela só não oferece os botões de
-- ação. Escrita exclusiva de gerente; sem policy de delete (ciclo de vida é
-- por status, nunca hard delete — mesmo padrão de chamados/rts/equipes).
create policy "urgencias_select_authenticated" on urgencias
  for select to authenticated using (true);

create policy "urgencias_insert_gerente" on urgencias
  for insert to authenticated with check (fn_current_role() = 'gerente');

create policy "urgencias_update_gerente" on urgencias
  for update to authenticated
  using (fn_current_role() = 'gerente')
  with check (fn_current_role() = 'gerente');

-- -----------------------------------------------------------------------------
-- 2) Extensão de `historico` — chamado_id vira nullable, urgencia_id novo
-- -----------------------------------------------------------------------------
alter table historico alter column chamado_id drop not null;

alter table historico add column urgencia_id uuid references urgencias(id) on delete cascade;

alter table historico add constraint historico_chamado_or_urgencia_check
  check (chamado_id is not null or urgencia_id is not null);

create index idx_historico_urgencia on historico (urgencia_id, criado_em);

-- Nenhuma policy de historico precisa mudar: "historico_insert_gerente_gestao"
-- (0014) checa só role, sem referenciar chamado_id; "historico_insert_tecnico_own"
-- (0014) não se aplica a eventos de urgência (só gerente grava nesse estágio).

-- -----------------------------------------------------------------------------
-- 3) Storage — bucket privado pra anexo do registro de urgência (print da
--    mensagem, etc.). Dedicado em vez de reaproveitar o bucket `evidencias`
--    porque as policies de lá são keyed por posse de `servico_id`, que
--    ainda não existe nesse estágio.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'urgencias-anexos',
  'urgencias-anexos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "urgencias_anexos_storage_insert_gerente" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'urgencias-anexos' and fn_current_role() = 'gerente'
  );

create policy "urgencias_anexos_storage_select" on storage.objects for select
  to authenticated using (
    bucket_id = 'urgencias-anexos' and fn_current_role() in ('gerente', 'gestao')
  );

-- -----------------------------------------------------------------------------
-- 4) fn_gerar_codigo_urgencia — 'URG-2026-001'. Contagem por ano dentro da
--    própria transação de fn_registrar_urgencia; corrida teórica entre dois
--    registros simultâneos aceita como limitação conhecida (mesma premissa
--    já registrada no projeto: só um gerente opera por vez).
-- -----------------------------------------------------------------------------
create or replace function fn_gerar_codigo_urgencia()
returns text
language plpgsql
as $$
declare
  v_ano text := to_char(now(), 'YYYY');
  v_seq integer;
begin
  select count(*) + 1 into v_seq
  from urgencias
  where codigo like 'URG-' || v_ano || '-%';

  return 'URG-' || v_ano || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) fn_registrar_urgencia — único jeito suportado de criar uma urgência.
--    `p_chamado_id` é opcional (o gerente pode já saber o protocolo, se
--    houver um `chamados` real pra ele) — não é o caminho comum, mas evita
--    duplicar quando o chamado já existe.
-- -----------------------------------------------------------------------------
create or replace function fn_registrar_urgencia(
  p_rt_id       uuid,
  p_chamado_id  uuid,
  p_descricao   text,
  p_motivo      text,
  p_solicitante text,
  p_prioridade  prioridade_chamado,
  p_anexo_path  text
) returns uuid
language plpgsql
as $$
declare
  v_urgencia_id uuid;
  v_codigo      text;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode registrar uma urgência.';
  end if;
  if p_rt_id is null then
    raise exception 'Selecione a RT da urgência.';
  end if;
  if p_descricao is null or btrim(p_descricao) = '' then
    raise exception 'Descreva a urgência.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Informe o motivo da urgência.';
  end if;
  if p_solicitante is null or btrim(p_solicitante) = '' then
    raise exception 'Informe quem solicitou.';
  end if;

  v_codigo := fn_gerar_codigo_urgencia();

  insert into urgencias (codigo, rt_id, chamado_id, descricao, motivo, solicitante, prioridade, anexo_path, criado_por)
  values (v_codigo, p_rt_id, p_chamado_id, p_descricao, p_motivo, p_solicitante, p_prioridade, p_anexo_path, auth.uid())
  returning id into v_urgencia_id;

  insert into historico (urgencia_id, evento, descricao, criado_por)
  values (v_urgencia_id, 'urgencia_registrada', format('%s registrada — solicitante: %s.', v_codigo, p_solicitante), auth.uid());

  return v_urgencia_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6) fn_analisar_urgencia — solicitada -> em_analise.
-- -----------------------------------------------------------------------------
create or replace function fn_analisar_urgencia(p_urgencia_id uuid)
returns void
language plpgsql
as $$
declare
  v_status text;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode analisar uma urgência.';
  end if;

  select status into v_status from urgencias where id = p_urgencia_id;
  if not found then
    raise exception 'Urgência não encontrada.';
  end if;
  if v_status <> 'solicitada' then
    raise exception 'Só é possível iniciar análise de uma urgência solicitada.';
  end if;

  update urgencias set status = 'em_analise', analisado_em = now() where id = p_urgencia_id;

  insert into historico (urgencia_id, evento, descricao, criado_por)
  values (p_urgencia_id, 'urgencia_em_analise', 'Urgência em análise.', auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- 7) fn_validar_urgencia — (solicitada|em_analise) -> validada. Fixa a
--    prioridade final (item importante: "solicitada pelo coordenador não
--    significa automaticamente validada" — o gerente decide aqui).
-- -----------------------------------------------------------------------------
create or replace function fn_validar_urgencia(p_urgencia_id uuid, p_prioridade prioridade_chamado)
returns void
language plpgsql
as $$
declare
  v_status text;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode validar uma urgência.';
  end if;
  if p_prioridade is null then
    raise exception 'Selecione a prioridade da urgência.';
  end if;

  select status into v_status from urgencias where id = p_urgencia_id;
  if not found then
    raise exception 'Urgência não encontrada.';
  end if;
  if v_status not in ('solicitada', 'em_analise') then
    raise exception 'Só é possível validar uma urgência solicitada ou em análise.';
  end if;

  update urgencias
  set status = 'validada', prioridade = p_prioridade, validado_por = auth.uid(), validado_em = now()
  where id = p_urgencia_id;

  insert into historico (urgencia_id, evento, descricao, criado_por)
  values (p_urgencia_id, 'urgencia_validada', 'Urgência validada — emergência confirmada.', auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- 8) fn_invalidar_urgencia — (solicitada|em_analise) -> nao_validada. Motivo
--    obrigatório, mesmo padrão de fn_reagendar_servico/fn_recusar_servico.
-- -----------------------------------------------------------------------------
create or replace function fn_invalidar_urgencia(p_urgencia_id uuid, p_motivo text)
returns void
language plpgsql
as $$
declare
  v_status text;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode marcar uma urgência como não validada.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Informe o motivo.';
  end if;

  select status into v_status from urgencias where id = p_urgencia_id;
  if not found then
    raise exception 'Urgência não encontrada.';
  end if;
  if v_status not in ('solicitada', 'em_analise') then
    raise exception 'Só é possível invalidar uma urgência solicitada ou em análise.';
  end if;

  update urgencias set status = 'nao_validada', motivo_nao_validada = p_motivo where id = p_urgencia_id;

  insert into historico (urgencia_id, evento, descricao, criado_por)
  values (p_urgencia_id, 'urgencia_nao_validada', p_motivo, auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- 9) fn_cancelar_urgencia — cancela um registro em qualquer estágio ainda
--    não terminal (ex.: registrado por engano).
-- -----------------------------------------------------------------------------
create or replace function fn_cancelar_urgencia(p_urgencia_id uuid, p_motivo text)
returns void
language plpgsql
as $$
declare
  v_status text;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode cancelar uma urgência.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  select status into v_status from urgencias where id = p_urgencia_id;
  if not found then
    raise exception 'Urgência não encontrada.';
  end if;
  if v_status in ('em_atendimento', 'cancelada', 'nao_validada') then
    raise exception 'Essa urgência não pode mais ser cancelada por aqui.';
  end if;

  update urgencias set status = 'cancelada', motivo_cancelamento = p_motivo where id = p_urgencia_id;

  insert into historico (urgencia_id, evento, descricao, criado_por)
  values (p_urgencia_id, 'urgencia_cancelada', p_motivo, auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- 10) fn_decidir_atendimento_urgencia — o coração do módulo. `security
--     invoker` (padrão do projeto) — cada INSERT que ela faz já tem policy
--     própria pra gerente (chamados_insert_gerente 0002, rotas_insert_gerente
--     e rota_rts_insert_gerente 0011, servicos_insert_gerente e
--     historico_insert_gerente_gestao 0014, urgencias_update_gerente acima).
--
--     p_opcao é só rótulo de auditoria — a ação mecânica tem só 2 formas:
--       - p_rota_id informado: acrescenta 1 parada ao FIM da rota
--         confirmada de hoje (nunca renumera as existentes — ver nota da
--         seção 3 do cabeçalho). Cobre "insercao_rota"/"fim_de_rota" (mesma
--         equipe) e "outra_equipe" (rota de outra equipe).
--       - p_rota_id nulo (p_opcao = 'avulsa'): cria uma `rotas` nova de 1
--         parada, mesmo formato que fn_confirmar_rota já produz.
-- -----------------------------------------------------------------------------
create or replace function fn_decidir_atendimento_urgencia(
  p_urgencia_id uuid,
  p_opcao       text,
  p_rota_id     uuid,
  p_equipe_id   uuid,
  p_tecnico_id  uuid,
  p_impacto_km  numeric,
  p_impacto_min integer
) returns uuid
language plpgsql
as $$
declare
  v_status        text;
  v_rt_id         uuid;
  v_descricao     text;
  v_motivo        text;
  v_prioridade    prioridade_chamado;
  v_chamado_id    uuid;
  v_servico_id    uuid;
  v_rota_id       uuid;
  v_regiao_id     uuid;
  v_proxima_ordem integer;
  v_tecnico_ok    boolean;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode decidir o atendimento de uma urgência.';
  end if;
  if p_opcao not in ('insercao_rota', 'fim_de_rota', 'outra_equipe', 'avulsa') then
    raise exception 'Opção de atendimento inválida.';
  end if;
  if p_equipe_id is null or p_tecnico_id is null then
    raise exception 'Selecione a equipe e o técnico responsável.';
  end if;

  select status, rt_id, descricao, motivo, prioridade, chamado_id
  into v_status, v_rt_id, v_descricao, v_motivo, v_prioridade, v_chamado_id
  from urgencias where id = p_urgencia_id;

  if not found then
    raise exception 'Urgência não encontrada.';
  end if;
  if v_status <> 'validada' then
    raise exception 'Só é possível decidir o atendimento de uma urgência validada.';
  end if;

  select exists (
    select 1 from profiles
    where id = p_tecnico_id and role = 'tecnico' and ativo = true and equipe_id = p_equipe_id
  ) into v_tecnico_ok;
  if not v_tecnico_ok then
    raise exception 'Técnico inválido: precisa ser um técnico ativo da equipe selecionada.';
  end if;

  -- 1) chamado real, se a urgência ainda não tiver um vinculado
  if v_chamado_id is null then
    insert into chamados (rt_id, assunto, descricao, prioridade, status)
    values (v_rt_id, '[URGÊNCIA] ' || v_motivo, v_descricao, coalesce(v_prioridade, 'alta'), 'aberto')
    returning id into v_chamado_id;

    update urgencias set chamado_id = v_chamado_id where id = p_urgencia_id;
  end if;

  -- 2) rota: existente (recebe 1 parada nova) ou avulsa nova
  if p_opcao = 'avulsa' then
    select regiao_id into v_regiao_id from rts where id = v_rt_id;

    insert into rotas (data, regiao_id, equipe_id, responsavel_id, status, confirmada_em)
    values (current_date, v_regiao_id, p_equipe_id, auth.uid(), 'confirmada', now())
    returning id into v_rota_id;

    v_proxima_ordem := 1;
  else
    if p_rota_id is null then
      raise exception 'Selecione a rota que vai receber a urgência.';
    end if;

    select id into v_rota_id from rotas
    where id = p_rota_id and data = current_date and status = 'confirmada';
    if v_rota_id is null then
      raise exception 'A rota selecionada não é uma rota confirmada de hoje.';
    end if;

    select coalesce(max(ordem), 0) + 1 into v_proxima_ordem from rota_rts where rota_id = v_rota_id;
  end if;

  insert into rota_rts (rota_id, rt_id, ordem, tecnico_id)
  values (v_rota_id, v_rt_id, v_proxima_ordem, p_tecnico_id);

  -- 3) serviço — reaproveita um já existente e não-cancelado se por algum
  --    motivo já houver um pra esse chamado (mesma checagem de dedup de
  --    fn_confirmar_rota, 0015/0018), senão cria um novo.
  select id into v_servico_id from servicos where chamado_id = v_chamado_id and status <> 'cancelado' limit 1;
  if v_servico_id is null then
    insert into servicos (rota_id, chamado_id, rt_id, tecnico_id, status)
    values (v_rota_id, v_chamado_id, v_rt_id, p_tecnico_id, 'planejado')
    returning id into v_servico_id;
  end if;

  -- 4) atualiza a urgência e registra histórico (a partir daqui, também no chamado)
  update urgencias
  set status = 'em_atendimento',
      atendida_por_servico_id = v_servico_id,
      opcao_escolhida = p_opcao,
      equipe_escolhida_id = p_equipe_id,
      impacto_km = p_impacto_km,
      impacto_min = p_impacto_min
  where id = p_urgencia_id;

  insert into historico (urgencia_id, chamado_id, evento, descricao, criado_por)
  values (
    p_urgencia_id,
    v_chamado_id,
    'urgencia_atendimento_decidido',
    format('Atendimento decidido (%s) — %s km / %s min estimados.',
      p_opcao, coalesce(p_impacto_km::text, '—'), coalesce(p_impacto_min::text, '—')),
    auth.uid()
  );

  return v_servico_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11) fn_vincular_urgencia_tomticket — preenche `chamados.tomticket_id`
--     quando o protocolo real aparecer (hoje, só via import diário manual —
--     ver Atualizações_futuras.md sobre a API do TomTicket, fora de escopo
--     aqui). Só cobre o caso simples (chamado sem protocolo ainda); se já
--     existir outro `chamados` com esse protocolo, recusa — fusão de
--     duplicata fica pra reconciliação manual assistida.
-- -----------------------------------------------------------------------------
create or replace function fn_vincular_urgencia_tomticket(p_urgencia_id uuid, p_tomticket_id text)
returns void
language plpgsql
as $$
declare
  v_chamado_id      uuid;
  v_tomticket_atual text;
  v_conflito        uuid;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode vincular uma urgência ao TomTicket.';
  end if;
  if p_tomticket_id is null or btrim(p_tomticket_id) = '' then
    raise exception 'Informe o protocolo do TomTicket.';
  end if;

  select chamado_id into v_chamado_id from urgencias where id = p_urgencia_id;
  if v_chamado_id is null then
    raise exception 'Essa urgência ainda não gerou um chamado — decida o atendimento primeiro.';
  end if;

  select tomticket_id into v_tomticket_atual from chamados where id = v_chamado_id;
  if v_tomticket_atual is not null and v_tomticket_atual <> p_tomticket_id then
    raise exception 'Esse chamado já está vinculado a outro protocolo (%).', v_tomticket_atual;
  end if;

  select id into v_conflito from chamados where tomticket_id = p_tomticket_id and id <> v_chamado_id;
  if v_conflito is not null then
    raise exception 'Já existe outro chamado com esse protocolo (provavelmente veio do import diário) — precisa de reconciliação manual antes de vincular.';
  end if;

  update chamados set tomticket_id = p_tomticket_id, atualizado_em = now() where id = v_chamado_id;

  insert into historico (chamado_id, urgencia_id, evento, descricao, criado_por)
  values (v_chamado_id, p_urgencia_id, 'urgencia_vinculada_tomticket', format('Vinculado ao protocolo #%s.', p_tomticket_id), auth.uid());
end;
$$;

-- Nenhuma mudança em fn_confirmar_rota: a dedup por "já existe servico não
-- cancelado pra esse chamado" (0015/0018) já protege automaticamente o
-- chamado nascido de urgência contra ser recapturado numa rota futura.
