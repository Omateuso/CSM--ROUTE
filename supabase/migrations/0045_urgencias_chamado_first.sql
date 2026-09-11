-- =============================================================================
-- Central de Urgências — modelo "chamado primeiro" (11/09/2026)
--
-- Prompt fechado do usuário pediu um desenho diferente do que a 0027 (04/09)
-- construiu: a urgência nunca deve criar/duplicar um chamado — ela sempre
-- nasce de um chamado JÁ existente (sincronizado do TomTicket ou cadastrado
-- manualmente), buscado por protocolo/RT/assunto. "Prioridade do TomTicket"
-- e "urgência operacional" são conceitos independentes — a prioridade
-- original do chamado NUNCA é escrita por nenhuma função deste módulo.
--
-- Decisões confirmadas com o usuário em 11/09/2026 (AskUserQuestion):
--   1. Só chamado existente — nunca sintetiza um `chamados` novo.
--   2. Painel de despacho construído do zero (não reaproveita o protótipo
--      de 04/09 que tinha ficado num `git stash`, descartado a pedido do
--      usuário em 09/09).
--   3. Sem GPS ao vivo do técnico — a tabela `tecnico_posicao` foi removida
--      de propósito na 0041 (decisão de privacidade) e não volta aqui. O
--      sinal de disponibilidade é carga de trabalho (servicos em
--      planejado/em_execucao hoje) + posição pela ÚLTIMA parada da rota
--      confirmada, calculado em lib/routing/urgencia-impacto.ts (server).
--   4. Mapa continua em Leaflet + OSM/ORS (infra já em produção desde
--      10/09) — sem reintroduzir Google Maps.
--
-- Mudanças de schema:
--   - `urgencias.rt_id` sai — a RT é sempre derivada de `chamados.rt_id`
--     (o chamado agora é obrigatório desde o registro, então guardar rt_id
--     em duplicidade só criaria risco de dessincronia).
--   - `urgencias.descricao` sai — "o que foi relatado" já está em
--     `chamados.assunto`/`descricao`; duplicar isso na urgência era
--     exatamente o que o prompt pediu pra evitar (seção 23: "NÃO duplicar
--     endereço/descrição/RT manualmente").
--   - `urgencias.chamado_id` vira NOT NULL + `on delete restrict` (era
--     nullable + `on delete set null`, pensado pro caso "ainda não existe
--     chamado" que deixou de existir).
--   - `urgencias.origem` novo (whatsapp/telefone/coordenacao_caps/
--     identificacao_operacional/outro) — texto+check, mesmo padrão que
--     `status`/`opcao_escolhida` já usavam nesta tabela (não um `enum`
--     Postgres novo).
--   - Índice único parcial: só uma urgência não-terminal por chamado por
--     vez (evita duas escaladas paralelas confundindo o despacho).
--   - `fn_vincular_urgencia_tomticket` é dropada — não faz mais sentido
--     quando o chamado (com ou sem protocolo) já é obrigatório desde o
--     registro.
--   - Toda função do módulo passa a gravar `chamado_id` (além de
--     `urgencia_id`) em CADA evento de `historico`, desde o registro — como
--     o chamado sempre existe agora, isso simplifica de vez o achado da
--     04/09 de que a timeline pré-decisão ficava presa numa página própria:
--     a partir de agora ela aparece direto no modal de Chamados também
--     (lib/ui/historico-chamado.tsx já lê por chamado_id).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Dado de teste órfão (sem chamado_id) — REMOVIDO, não só cancelado.
--
--    Achado ao tentar aplicar esta migration (11/09/2026): `URG-2026-001` e
--    `URG-2026-002` já estavam com `chamado_id = null` ANTES desta migration
--    — os chamados sintéticos fictícios que elas apontavam foram apagados
--    num reset de dados operacionais anterior (`scripts/reset-dados-
--    operacionais.mjs`, que não conhece `urgencias`), e a FK antiga
--    (`on delete set null`, 0027) deixou as duas linhas órfãs em vez de
--    bloquear ou cascatear a exclusão. Só marcar `status = 'cancelada'`
--    (primeira tentativa desta migration) NÃO resolve — a coluna
--    `chamado_id` continua nula, e o `set not null` do passo 3 falha do
--    mesmo jeito (`23502: column "chamado_id" ... contains null values`).
--
--    Sem chamado real pra apontar, não há como preservar a linha sob o novo
--    modelo — remover é a única opção correta. `historico.urgencia_id`
--    tem `on delete cascade` (0027), então os eventos associados a essas 2
--    urgências saem juntos, sem precisar de um DELETE separado.
-- -----------------------------------------------------------------------------
delete from urgencias where chamado_id is null;

-- -----------------------------------------------------------------------------
-- 2) origem — novo, backfill 'outro' pro pouco dado de teste que já existe.
-- -----------------------------------------------------------------------------
alter table urgencias add column origem text;
update urgencias set origem = 'outro' where origem is null;
alter table urgencias add constraint urgencias_origem_check
  check (origem in ('whatsapp', 'telefone', 'coordenacao_caps', 'identificacao_operacional', 'outro'));
alter table urgencias alter column origem set not null;

-- -----------------------------------------------------------------------------
-- 3) chamado_id obrigatório e estável — nunca mais criado/desvinculado por
--    aqui, então "on delete set null" deixou de fazer sentido (chamado
--    nunca é hard-deleted no sistema, mas "restrict" é a intenção correta
--    do vínculo agora).
-- -----------------------------------------------------------------------------
alter table urgencias drop constraint urgencias_chamado_id_fkey;
alter table urgencias alter column chamado_id set not null;
alter table urgencias add constraint urgencias_chamado_id_fkey
  foreign key (chamado_id) references chamados(id) on delete restrict;

-- Só uma urgência "em jogo" por chamado por vez (nao_validada/cancelada são
-- terminais e liberam o chamado pra ser escalado de novo no futuro).
create unique index urgencias_chamado_ativa_uidx on urgencias (chamado_id)
  where status not in ('cancelada', 'nao_validada');

-- -----------------------------------------------------------------------------
-- 4) rt_id e descricao saem — dados agora só vivem em `chamados`/`rts`.
-- -----------------------------------------------------------------------------
alter table urgencias drop column rt_id;
alter table urgencias drop column descricao;

-- -----------------------------------------------------------------------------
-- 5) fn_registrar_urgencia — reescrita: recebe chamado_id (obrigatório),
--    não recebe mais rt_id/descricao/prioridade (prioridade só é fixada na
--    validação, como já era). Recusa chamado encerrado ou já com urgência
--    ativa.
-- -----------------------------------------------------------------------------
drop function if exists fn_registrar_urgencia(uuid, uuid, text, text, text, prioridade_chamado, text);

create or replace function fn_registrar_urgencia(
  p_chamado_id  uuid,
  p_motivo      text,
  p_origem      text,
  p_solicitante text,
  p_anexo_path  text
) returns uuid
language plpgsql
as $$
declare
  v_urgencia_id     uuid;
  v_codigo          text;
  v_status_chamado  status_chamado;
  v_existente       uuid;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode registrar uma urgência.';
  end if;
  if p_chamado_id is null then
    raise exception 'Selecione o chamado da urgência.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Informe o motivo da urgência.';
  end if;
  if p_origem not in ('whatsapp', 'telefone', 'coordenacao_caps', 'identificacao_operacional', 'outro') then
    raise exception 'Origem inválida.';
  end if;
  if p_solicitante is null or btrim(p_solicitante) = '' then
    raise exception 'Informe quem solicitou.';
  end if;

  select status into v_status_chamado from chamados where id = p_chamado_id;
  if not found then
    raise exception 'Chamado não encontrado.';
  end if;
  if v_status_chamado in ('finalizado', 'cancelado') then
    raise exception 'Esse chamado já foi encerrado — não é possível registrar uma urgência para ele.';
  end if;

  select id into v_existente from urgencias
   where chamado_id = p_chamado_id and status not in ('cancelada', 'nao_validada');
  if v_existente is not null then
    raise exception 'Já existe uma urgência em andamento para esse chamado.';
  end if;

  v_codigo := fn_gerar_codigo_urgencia();

  insert into urgencias (codigo, chamado_id, motivo, origem, solicitante, anexo_path, criado_por)
  values (v_codigo, p_chamado_id, p_motivo, p_origem, p_solicitante, p_anexo_path, auth.uid())
  returning id into v_urgencia_id;

  insert into historico (chamado_id, urgencia_id, evento, descricao, criado_por)
  values (
    p_chamado_id, v_urgencia_id, 'urgencia_registrada',
    format('%s registrada — solicitante: %s.', v_codigo, p_solicitante),
    auth.uid()
  );

  return v_urgencia_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6) fn_analisar_urgencia / fn_validar_urgencia / fn_invalidar_urgencia /
--    fn_cancelar_urgencia — mesma assinatura e regra, só passam a gravar
--    chamado_id (já obrigatório) em `historico` também.
-- -----------------------------------------------------------------------------
create or replace function fn_analisar_urgencia(p_urgencia_id uuid)
returns void
language plpgsql
as $$
declare
  v_status     text;
  v_chamado_id uuid;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode analisar uma urgência.';
  end if;

  select status, chamado_id into v_status, v_chamado_id from urgencias where id = p_urgencia_id;
  if not found then
    raise exception 'Urgência não encontrada.';
  end if;
  if v_status <> 'solicitada' then
    raise exception 'Só é possível iniciar análise de uma urgência solicitada.';
  end if;

  update urgencias set status = 'em_analise', analisado_em = now() where id = p_urgencia_id;

  insert into historico (chamado_id, urgencia_id, evento, descricao, criado_por)
  values (v_chamado_id, p_urgencia_id, 'urgencia_em_analise', 'Urgência em análise.', auth.uid());
end;
$$;

create or replace function fn_validar_urgencia(p_urgencia_id uuid, p_prioridade prioridade_chamado)
returns void
language plpgsql
as $$
declare
  v_status     text;
  v_chamado_id uuid;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode validar uma urgência.';
  end if;
  if p_prioridade is null then
    raise exception 'Selecione a classificação da urgência.';
  end if;

  select status, chamado_id into v_status, v_chamado_id from urgencias where id = p_urgencia_id;
  if not found then
    raise exception 'Urgência não encontrada.';
  end if;
  if v_status not in ('solicitada', 'em_analise') then
    raise exception 'Só é possível validar uma urgência solicitada ou em análise.';
  end if;

  update urgencias
  set status = 'validada', prioridade = p_prioridade, validado_por = auth.uid(), validado_em = now()
  where id = p_urgencia_id;

  insert into historico (chamado_id, urgencia_id, evento, descricao, criado_por)
  values (v_chamado_id, p_urgencia_id, 'urgencia_validada', 'Urgência validada — emergência confirmada.', auth.uid());
end;
$$;

create or replace function fn_invalidar_urgencia(p_urgencia_id uuid, p_motivo text)
returns void
language plpgsql
as $$
declare
  v_status     text;
  v_chamado_id uuid;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode marcar uma urgência como não validada.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Informe o motivo.';
  end if;

  select status, chamado_id into v_status, v_chamado_id from urgencias where id = p_urgencia_id;
  if not found then
    raise exception 'Urgência não encontrada.';
  end if;
  if v_status not in ('solicitada', 'em_analise') then
    raise exception 'Só é possível invalidar uma urgência solicitada ou em análise.';
  end if;

  update urgencias set status = 'nao_validada', motivo_nao_validada = p_motivo where id = p_urgencia_id;

  insert into historico (chamado_id, urgencia_id, evento, descricao, criado_por)
  values (v_chamado_id, p_urgencia_id, 'urgencia_nao_validada', p_motivo, auth.uid());
end;
$$;

create or replace function fn_cancelar_urgencia(p_urgencia_id uuid, p_motivo text)
returns void
language plpgsql
as $$
declare
  v_status     text;
  v_chamado_id uuid;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode cancelar uma urgência.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Informe o motivo do cancelamento.';
  end if;

  select status, chamado_id into v_status, v_chamado_id from urgencias where id = p_urgencia_id;
  if not found then
    raise exception 'Urgência não encontrada.';
  end if;
  if v_status in ('em_atendimento', 'cancelada', 'nao_validada') then
    raise exception 'Essa urgência não pode mais ser cancelada por aqui.';
  end if;

  update urgencias set status = 'cancelada', motivo_cancelamento = p_motivo where id = p_urgencia_id;

  insert into historico (chamado_id, urgencia_id, evento, descricao, criado_por)
  values (v_chamado_id, p_urgencia_id, 'urgencia_cancelada', p_motivo, auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- 7) fn_decidir_atendimento_urgencia — não cria mais `chamados` (ele já
--    existe desde o registro). RT vem de `chamados.rt_id`. Resto do
--    mecanismo (parada sempre ao FIM da rota, dedup de serviço) inalterado.
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
  v_chamado_id    uuid;
  v_rt_id         uuid;
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

  select status, chamado_id into v_status, v_chamado_id from urgencias where id = p_urgencia_id;
  if not found then
    raise exception 'Urgência não encontrada.';
  end if;
  if v_status <> 'validada' then
    raise exception 'Só é possível decidir o atendimento de uma urgência validada.';
  end if;

  select rt_id into v_rt_id from chamados where id = v_chamado_id;
  if v_rt_id is null then
    raise exception 'Chamado da urgência não encontrado.';
  end if;

  select exists (
    select 1 from profiles
    where id = p_tecnico_id and role = 'tecnico' and ativo = true and equipe_id = p_equipe_id
  ) into v_tecnico_ok;
  if not v_tecnico_ok then
    raise exception 'Técnico inválido: precisa ser um técnico ativo da equipe selecionada.';
  end if;

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

  select id into v_servico_id from servicos where chamado_id = v_chamado_id and status <> 'cancelado' limit 1;
  if v_servico_id is null then
    insert into servicos (rota_id, chamado_id, rt_id, tecnico_id, status)
    values (v_rota_id, v_chamado_id, v_rt_id, p_tecnico_id, 'planejado')
    returning id into v_servico_id;
  end if;

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
-- 8) fn_vincular_urgencia_tomticket sai — não existe mais o caso "chamado
--    sintético sem protocolo" que ela resolvia (chamado, com ou sem
--    protocolo, já é obrigatório desde o registro).
-- -----------------------------------------------------------------------------
drop function if exists fn_vincular_urgencia_tomticket(uuid, text);
