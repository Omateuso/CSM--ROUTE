-- =============================================================================
-- Reexecução não reentra sozinha na mesma rota (achado testando a Fase 1, 10/09/2026)
--
-- `fn_atualizar_servicos_rota` (0032) completa uma rota confirmada com os
-- chamados que ficaram elegíveis DEPOIS da montagem — foi feita pra pegar
-- chamado novo que chega pela sincronização com o TomTicket (0030). Mas a
-- regra de elegibilidade ("chamado não fechado e sem serviço ativo") também
-- casava com um chamado cujo serviço acabou de ser CANCELADO por uma
-- pendência na própria rota: a sync de 5 min recolocava o chamado nessa
-- mesma rota, com o mesmo técnico, ANTES de o gerente poder decidir por
-- "Programar nova execução" (Fase 1, `fn_programar_reexecucao`, 0034).
--
-- Efeito prático ruim: uma pendência do tipo "aguardando decisão da gestão"
-- voltava pra rota do dia sozinha — o técnico só reportaria pendência de
-- novo. E o "Programar nova execução" respondia "nada pra reexecutar",
-- porque o chamado já tinha sido recolocado.
--
-- Correção: `fn_atualizar_servicos_rota` passa a deixar de fora qualquer
-- chamado que JÁ TEVE um serviço nessa rota (cancelado ou não). O propósito
-- da função fica intacto — chamado novo, que nunca teve serviço na rota,
-- continua sendo pego. Retentar um chamado que já passou pela rota é
-- decisão do gerente (Programar nova execução, ou montar outra rota) —
-- caminhos que não passam por esta função.
--
-- Bônus: `fn_programar_reexecucao` ganha uma mensagem específica pra quando
-- o chamado da pendência já está agendado em outra rota.
-- =============================================================================

create or replace function fn_atualizar_servicos_rota(p_rota_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status     status_rota;
  v_rt_id      uuid;
  v_tecnico_id uuid;
  v_chamado_id uuid;
  v_criados    integer := 0;
begin
  -- Gerente pelo app, ou a própria sincronização com service role (cron não
  -- tem sessão). `auth.role()` é 'anon' pra quem chega sem credencial.
  if fn_current_role() is distinct from 'gerente'
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Só o gerente pode atualizar os serviços de uma rota.';
  end if;

  select status into v_status from rotas where id = p_rota_id;
  if not found then
    raise exception 'Rota não encontrada.';
  end if;
  if v_status <> 'confirmada' then
    return 0;
  end if;

  for v_rt_id, v_tecnico_id in
    select rt_id, tecnico_id from rota_rts where rota_id = p_rota_id
  loop
    if v_tecnico_id is null then
      continue;
    end if;

    for v_chamado_id in
      select c.id from chamados c
      where c.rt_id = v_rt_id
        and c.status not in ('finalizado', 'cancelado')
        and not exists (
          select 1 from servicos sv where sv.chamado_id = c.id and sv.status <> 'cancelado'
        )
        -- NOVO (0040): esta rota já lidou com o chamado alguma vez (serviço
        -- cancelado por pendência/reagendamento, ou já validado). O
        -- auto-completar não retenta sozinho — isso é decisão do gerente.
        and not exists (
          select 1 from servicos sv where sv.chamado_id = c.id and sv.rota_id = p_rota_id
        )
    loop
      insert into servicos (rota_id, chamado_id, rt_id, tecnico_id, status)
      values (p_rota_id, v_chamado_id, v_rt_id, v_tecnico_id, 'planejado');

      insert into historico (chamado_id, evento, descricao, criado_por)
      values (
        v_chamado_id,
        'servico_planejado',
        'Incluído numa rota já confirmada (chamado chegou depois da montagem).',
        auth.uid()
      );

      v_criados := v_criados + 1;
    end loop;
  end loop;

  return v_criados;
end;
$$;

-- -----------------------------------------------------------------------------
-- fn_programar_reexecucao — mesma assinatura (4 params + default), só muda o
-- final: distingue "já agendado em outra rota" de "nada elegível de verdade".
-- -----------------------------------------------------------------------------
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
  v_chamado_orig uuid;
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

  select rt_id, status, chamado_id into v_rt_id, v_status_orig, v_chamado_orig
  from servicos where id = p_servico_cancelado_id;
  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_status_orig <> 'cancelado' then
    raise exception 'Só um serviço cancelado (pendência ou reagendamento) pode ser reexecutado.';
  end if;

  select status, equipe_id into v_rota_status, v_equipe_id
  from rotas where id = p_rota_id;
  if not found then
    raise exception 'Rota não encontrada.';
  end if;
  if v_rota_status <> 'confirmada' then
    raise exception 'Só dá pra anexar a reexecução a uma rota confirmada.';
  end if;

  select exists (
    select 1 from profiles
    where id = p_tecnico_id and role = 'tecnico' and ativo = true and equipe_id = v_equipe_id
  ) into v_tecnico_ok;
  if not v_tecnico_ok then
    raise exception 'Técnico inválido: precisa ser um técnico ativo da equipe da rota.';
  end if;

  select tecnico_id into v_parada_tec from rota_rts
  where rota_id = p_rota_id and rt_id = v_rt_id;
  v_ja_parada := found;

  if v_ja_parada then
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

  if v_criados = 0 then
    -- Rollback de tudo (inclusive a parada recém-inserida). Mensagem
    -- específica quando o motivo é "já foi reagendado" e não "não há nada".
    if exists (
      select 1 from servicos sv
      where sv.chamado_id = v_chamado_orig and sv.status <> 'cancelado'
    ) then
      raise exception 'Esse chamado já está agendado em outra rota — não há o que reexecutar.';
    end if;
    raise exception 'Nenhum chamado em aberto nessa RT — nada pra reexecutar.';
  end if;

  return v_criados;
end;
$$;
