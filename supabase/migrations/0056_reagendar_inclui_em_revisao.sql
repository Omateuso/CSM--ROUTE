-- =============================================================================
-- fn_reagendar_servico passa a aceitar `em_revisao` (0053/0054, 15/09/2026)
-- — um serviço em revisão travado numa rota já passada também precisa
-- poder ser reagendado, mesmo espírito de `planejado`/`em_execucao`.
-- =============================================================================

create or replace function fn_reagendar_servico(p_servico_id uuid, p_motivo text)
returns void
language plpgsql
as $$
declare
  v_status     status_servico;
  v_chamado_id uuid;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode reagendar um serviço.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Informe o motivo do reagendamento.';
  end if;

  select status, chamado_id into v_status, v_chamado_id
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_status not in ('planejado', 'em_execucao', 'em_revisao') then
    raise exception 'Só é possível reagendar um serviço planejado, em execução ou em revisão.';
  end if;

  update servicos set status = 'cancelado' where id = p_servico_id;

  insert into historico (chamado_id, servico_id, evento, descricao, criado_por)
  values (v_chamado_id, p_servico_id, 'servico_reagendado', p_motivo, auth.uid());
end;
$$;
