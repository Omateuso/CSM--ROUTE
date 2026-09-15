-- =============================================================================
-- `fn_iniciar_revisao` (nova) + `fn_revisar_servico` (ajustada) — usa o
-- status `em_revisao` adicionado sozinho na 0053 (precisa estar em migration
-- separada da que criou o valor, regra do Postgres pra enum).
--
-- Fluxo leve de revisão passa a ter DUAS etapas, espelhando o atendimento
-- completo (iniciar → concluir), só que mais enxuto:
--   planejado --[fn_iniciar_revisao]--> em_revisao --[fn_revisar_servico]--> concluido_tecnico
--
-- `fn_iniciar_revisao` NÃO exige nenhuma evidência (diferente de
-- `fn_iniciar_servico`, que exige foto "antes") — a filosofia do fluxo leve
-- continua sendo mínima, a foto só entra na conclusão (momento='revisao',
-- já exigida por `fn_revisar_servico` desde a 0047). Por isso também não
-- grava nada em `execucoes` (essa tabela documenta o tempo do atendimento
-- COMPLETO; o fluxo leve nunca usou ela, nem antes nem agora).
-- =============================================================================

create or replace function fn_iniciar_revisao(p_servico_id uuid)
returns void
language plpgsql
as $$
declare
  v_tecnico_id uuid;
  v_status     status_servico;
  v_categoria  text;
  v_chamado_id uuid;
  v_rota_id    uuid;
  v_rt_id      uuid;
begin
  select tecnico_id, status, categoria, chamado_id, rota_id, rt_id
    into v_tecnico_id, v_status, v_categoria, v_chamado_id, v_rota_id, v_rt_id
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if not fn_pode_atuar_servico(v_rota_id, v_rt_id, v_tecnico_id) then
    raise exception 'Esse serviço não é seu.';
  end if;
  if v_categoria is distinct from 'revisao_tecnica' then
    raise exception 'Esse chamado não está marcado como revisão técnica.';
  end if;
  if v_status <> 'planejado' then
    raise exception 'Esse serviço já foi iniciado ou concluído.';
  end if;

  update servicos set status = 'em_revisao' where id = p_servico_id;

  insert into historico (chamado_id, servico_id, evento, descricao, criado_por)
  values (v_chamado_id, p_servico_id, 'servico_revisao_iniciada', 'Técnico começou a revisar o chamado.', auth.uid());
end;
$$;

-- Só muda a precondição: `planejado` -> `em_revisao`. Resto (evidência,
-- conclusoes, historico, destino concluido_tecnico) fica idêntico à versão
-- da 0050.
create or replace function fn_revisar_servico(p_servico_id uuid, p_descricao text)
returns void
language plpgsql
as $$
declare
  v_tecnico_id uuid;
  v_status     status_servico;
  v_categoria  text;
  v_chamado_id uuid;
  v_rota_id    uuid;
  v_rt_id      uuid;
  v_equipe_id  uuid;
begin
  select s.tecnico_id, s.status, s.categoria, s.chamado_id, s.rota_id, s.rt_id
    into v_tecnico_id, v_status, v_categoria, v_chamado_id, v_rota_id, v_rt_id
  from servicos s where s.id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if not fn_pode_atuar_servico(v_rota_id, v_rt_id, v_tecnico_id) then
    raise exception 'Esse serviço não é seu.';
  end if;
  if v_categoria is distinct from 'revisao_tecnica' then
    raise exception 'Esse chamado não está marcado como revisão técnica.';
  end if;
  if v_status <> 'em_revisao' then
    raise exception 'Comece a revisar esse chamado antes de enviar a conclusão.';
  end if;
  if p_descricao is null or btrim(p_descricao) = '' then
    raise exception 'Descreva a situação encontrada e o que falta pra concluir.';
  end if;

  if not exists (
    select 1 from evidencias
    where servico_id = p_servico_id and tipo = 'foto' and momento = 'revisao'
  ) then
    raise exception 'Tire uma foto do local antes de enviar a revisão.';
  end if;

  select equipe_id into v_equipe_id from rotas where id = v_rota_id;

  update servicos set status = 'concluido_tecnico', concluido_em = now() where id = p_servico_id;

  insert into conclusoes (servico_id, chamado_id, equipe_id, tecnico_id, observacao)
  values (p_servico_id, v_chamado_id, v_equipe_id, auth.uid(), p_descricao);

  insert into historico (chamado_id, servico_id, evento, descricao, criado_por)
  values (
    v_chamado_id, p_servico_id, 'servico_revisado',
    'Técnico revisou o chamado — aguardando validação do gerente.', auth.uid()
  );
end;
$$;
