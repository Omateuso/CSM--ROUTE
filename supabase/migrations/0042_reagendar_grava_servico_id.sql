-- =============================================================================
-- fn_reagendar_servico grava servico_id no evento de histórico (10/09/2026)
--
-- Pedido do usuário: quando o gerente reagenda um serviço, o chamado deve
-- aparecer TAMBÉM na tela de Pendências (hoje só aparece pendência de verdade,
-- evento `servico_pendente`). A tela de Pendências resolve as evidências e liga
-- os botões de ação ("Programar nova execução", "Responder no TomTicket") por
-- `historico.servico_id` — e `fn_reagendar_servico` (0018) grava só o
-- `chamado_id`. Sem o `servico_id`, o card apareceria sem nenhuma ação.
--
-- `historico.servico_id` existe desde a 0026 (FK `on delete set null`); a policy
-- `historico_insert_gerente_gestao` (0014) não restringe coluna. Mudança
-- puramente aditiva: só a linha do `insert into historico` muda.
--
-- Serviços reagendados ANTES desta migration ficam com `servico_id = null` e
-- aparecem em Pendências sem os botões de ação — degradação aceitável de dado
-- histórico (mesmo padrão de outros retrofits do projeto).
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
  if v_status not in ('planejado', 'em_execucao') then
    raise exception 'Só é possível reagendar um serviço planejado ou em execução.';
  end if;

  update servicos set status = 'cancelado' where id = p_servico_id;

  insert into historico (chamado_id, servico_id, evento, descricao, criado_por)
  values (v_chamado_id, p_servico_id, 'servico_reagendado', p_motivo, auth.uid());
end;
$$;
