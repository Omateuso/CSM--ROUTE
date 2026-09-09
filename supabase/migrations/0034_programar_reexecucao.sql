-- =============================================================================
-- Programar nova execução de um chamado que ficou pendente
-- (Fase 1 da evolução operacional, pedido do usuário 09/09/2026)
--
-- Hoje: reportar pendência (0026) ou reagendar (0018) cancela o `servico`, o
-- chamado volta pro pool, e a única forma de reexecutar é montar uma rota nova
-- inteira. Esta função resolve isso a partir da tela de Pendências: o gerente
-- escolhe uma rota JÁ CONFIRMADA + o técnico, e a parada + serviço(s) são
-- ANEXADOS a ela. Decisão do usuário: rota existente, não rota avulsa.
--
-- ESCOPO (mesma regra da Fase 0 / fn_confirmar_rota sem p_chamado_ids): cria
-- serviço pra TODOS os chamados elegíveis da RT, não só o da pendência — o
-- técnico fica com todos os chamados em aberto da RT.
--
-- security definer + guard explícito de 'gerente' com `is distinct from`
-- (mesmo padrão de fn_cancelar_rota / fn_trocar_tecnico_parada /
-- fn_atualizar_servicos_rota — evita a brecha NULL da 0029).
-- =============================================================================

create or replace function fn_programar_reexecucao(
  p_servico_cancelado_id uuid,
  p_rota_id              uuid,
  p_tecnico_id           uuid,
  p_observacao           text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rt_id        uuid;
  v_status_orig  status_servico;
  v_rota_status  status_rota;
  v_equipe_id    uuid;
  v_ordem        integer;
  v_parada_tec   uuid;
  v_ja_parada    boolean;
  v_tecnico_ok   boolean;
  v_chamado_id   uuid;
  v_servico_id   uuid;
  v_obs          text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_criados      integer := 0;
begin
  if fn_current_role() is distinct from 'gerente' then
    raise exception 'Só o gerente pode programar uma nova execução.';
  end if;

  -- O serviço da pendência dá a RT e prova que cabe reexecutar.
  select rt_id, status into v_rt_id, v_status_orig
  from servicos where id = p_servico_cancelado_id;
  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_status_orig <> 'cancelado' then
    raise exception 'Só um serviço cancelado (pendência ou reagendamento) pode ser reexecutado.';
  end if;

  -- A rota tem que existir e estar confirmada — a função não cria rota.
  select status, equipe_id into v_rota_status, v_equipe_id
  from rotas where id = p_rota_id;
  if not found then
    raise exception 'Rota não encontrada.';
  end if;
  if v_rota_status <> 'confirmada' then
    raise exception 'Só dá pra anexar a reexecução a uma rota confirmada.';
  end if;

  -- Técnico precisa ser da equipe da rota (mesma checagem da fn_confirmar_rota).
  select exists (
    select 1 from profiles
    where id = p_tecnico_id and role = 'tecnico' and ativo = true and equipe_id = v_equipe_id
  ) into v_tecnico_ok;
  if not v_tecnico_ok then
    raise exception 'Técnico inválido: precisa ser um técnico ativo da equipe da rota.';
  end if;

  -- A RT já é parada dessa rota? (unique (rota_id, rt_id) em rota_rts)
  select tecnico_id into v_parada_tec from rota_rts
  where rota_id = p_rota_id and rt_id = v_rt_id;
  v_ja_parada := found;

  if v_ja_parada then
    -- Um técnico por parada: a reexecução segue o técnico que já está na
    -- parada. Só assume o escolhido se a parada estava sem técnico (rota
    -- anterior à 0015).
    if v_parada_tec is null then
      update rota_rts set tecnico_id = p_tecnico_id
      where rota_id = p_rota_id and rt_id = v_rt_id;
      v_parada_tec := p_tecnico_id;
    end if;
  else
    select coalesce(max(ordem), 0) + 1 into v_ordem from rota_rts where rota_id = p_rota_id;
    insert into rota_rts (rota_id, rt_id, ordem, tecnico_id)
    values (p_rota_id, v_rt_id, v_ordem, p_tecnico_id);
    v_parada_tec := p_tecnico_id;
  end if;

  -- Um serviço por chamado elegível da RT — não fechado no TomTicket e sem
  -- serviço ativo (serviço cancelado não conta, 0018).
  for v_chamado_id in
    select c.id from chamados c
    where c.rt_id = v_rt_id
      and c.status not in ('finalizado', 'cancelado')
      and not exists (
        select 1 from servicos sv where sv.chamado_id = c.id and sv.status <> 'cancelado'
      )
  loop
    insert into servicos (rota_id, chamado_id, rt_id, tecnico_id, status)
    values (p_rota_id, v_chamado_id, v_rt_id, v_parada_tec, 'planejado')
    returning id into v_servico_id;

    insert into historico (chamado_id, servico_id, evento, descricao, criado_por)
    values (
      v_chamado_id,
      v_servico_id,
      'servico_reexecucao_programada',
      case when v_obs is not null
           then 'Nova execução programada. ' || v_obs
           else 'Nova execução programada.' end,
      auth.uid()
    );

    v_criados := v_criados + 1;
  end loop;

  -- Nada elegível: rollback de tudo (inclusive a parada recém-inserida) —
  -- uma parada sem serviço nenhum não ajuda ninguém.
  if v_criados = 0 then
    raise exception 'Nenhum chamado em aberto nessa RT — nada pra reexecutar.';
  end if;

  return v_criados;
end;
$$;
