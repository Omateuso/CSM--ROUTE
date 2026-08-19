-- =============================================================================
-- Fase 3 — Execução (ajuste pedido pelo usuário depois de testar de verdade,
-- 18/08/2026)
--
-- Decisão original (17/08, confirmada explicitamente antes de codar): foto
-- + OS + observação, todos obrigatórios pra concluir um serviço. Depois de
-- testar no celular de verdade, o usuário decidiu que só a OS deveria ser
-- obrigatória — foto vira opcional (o técnico pode nem sempre ter uma foto
-- relevante pra anexar, mas a OS documenta o atendimento de qualquer jeito).
-- Observação continua obrigatória (não mudou).
-- =============================================================================

create or replace function fn_concluir_servico(p_servico_id uuid, p_observacao text)
returns void
language plpgsql
as $$
declare
  v_tecnico_id uuid;
  v_status     status_servico;
  v_chamado_id uuid;
  v_rota_id    uuid;
  v_equipe_id  uuid;
  v_tem_os     boolean;
begin
  select s.tecnico_id, s.status, s.chamado_id, s.rota_id
  into v_tecnico_id, v_status, v_chamado_id, v_rota_id
  from servicos s where s.id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_tecnico_id is distinct from auth.uid() then
    raise exception 'Esse serviço não é seu.';
  end if;
  if v_status <> 'em_execucao' then
    raise exception 'Esse serviço precisa estar em execução para ser concluído.';
  end if;
  if p_observacao is null or btrim(p_observacao) = '' then
    raise exception 'Observação é obrigatória para concluir o serviço.';
  end if;

  select exists (select 1 from evidencias where servico_id = p_servico_id and tipo = 'os') into v_tem_os;

  if not v_tem_os then
    raise exception 'Anexe a OS antes de concluir o serviço.';
  end if;

  select equipe_id into v_equipe_id from rotas where id = v_rota_id;

  update servicos set status = 'concluido_tecnico', concluido_em = now() where id = p_servico_id;

  update execucoes set concluido_em = now(), observacao = p_observacao
    where servico_id = p_servico_id and concluido_em is null;

  insert into conclusoes (servico_id, chamado_id, equipe_id, tecnico_id, observacao)
  values (p_servico_id, v_chamado_id, v_equipe_id, auth.uid(), p_observacao);

  insert into historico (chamado_id, evento, descricao, criado_por)
  values (v_chamado_id, 'servico_concluido_tecnico', 'Técnico concluiu o atendimento — aguardando validação do gerente.', auth.uid());
end;
$$;
