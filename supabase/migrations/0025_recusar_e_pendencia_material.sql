-- =============================================================================
-- Fase 4 — Gestão (achado de uso real, 21/08/2026)
--
-- Gap encontrado pelo usuário testando os selos de integridade (Pacotes 1/2
-- da auditoria de segurança): a tela de validação só tinha "Validar" — não
-- havia como o gerente dizer "não confio nessa evidência, isso precisa
-- voltar" depois de ver um selo suspeito (localização não confere, OS
-- duplicada). "Reagendar" já existia, mas só funciona pra planejado/
-- em_execucao (serviço que nunca foi atendido) — não serve pra "foi
-- atendido, mas a evidência é suspeita".
--
-- 1) fn_recusar_servico — mesmo efeito de banco de fn_reagendar_servico
--    (cancela, chamado libera pra próxima rota), mas a partir de
--    `concluido_tecnico`, não `planejado`/`em_execucao`. Evento de
--    histórico PRÓPRIO (`servico_recusado`, não `servico_reagendado`) de
--    propósito — permite no futuro consultar "quantas vezes esse técnico
--    já teve serviço recusado" como sinal à parte, sem misturar com
--    reagendamento normal (que é logística, não desconfiança).
--
-- 2) Nova funcionalidade relacionada, mesma conversa: "pendência de
--    material" — cenário que não tinha lugar nenhum no sistema até agora.
--    Técnico chega na RT, começa o atendimento, mas não consegue terminar
--    por falta de peça/insumo (precisa comprar e voltar). Não é "concluí"
--    (não terminou) nem "não fiz" (foi lá, trabalhou). Ação nova a partir
--    de `em_execucao`, exige descrição do que falta + pelo menos 1 foto do
--    que já foi feito até ali (documenta o trabalho parcial e protege o
--    técnico — evidência de que ele foi, em vez de forçar ele a "fingir"
--    que concluiu). Mesmo efeito de cancelar + liberar pra nova rota.
--
--    `evidencias.momento` (0023) só aceitava 'antes'/'depois' — ganha um
--    terceiro valor 'parcial' pra essa foto de meio de atendimento (nome
--    da constraint segue o padrão automático do Postgres pra check inline
--    de coluna: `<tabela>_<coluna>_check`).
--
-- `fn_confirmar_rota` não precisa de nenhuma mudança pra nenhum dos dois
-- casos — a elegibilidade já é "chamado sem nenhum `servico` não-cancelado"
-- (0015/0018), então tanto recusa quanto pendência de material liberam o
-- chamado pra próxima rota automaticamente, mesmo mecanismo que reagendar
-- já usa hoje.
-- =============================================================================

alter table evidencias drop constraint evidencias_momento_check;
alter table evidencias add constraint evidencias_momento_check check (momento in ('antes', 'depois', 'parcial'));

-- -----------------------------------------------------------------------------
-- 1) fn_recusar_servico — gerente recusa um serviço concluído em que não
--    confia (evidência suspeita, achado do gerente conversando com o
--    técnico por fora do sistema).
-- -----------------------------------------------------------------------------
create or replace function fn_recusar_servico(p_servico_id uuid, p_motivo text)
returns void
language plpgsql
as $$
declare
  v_status     status_servico;
  v_chamado_id uuid;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode recusar um serviço.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Informe o motivo da recusa.';
  end if;

  select status, chamado_id into v_status, v_chamado_id
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_status <> 'concluido_tecnico' then
    raise exception 'Só é possível recusar um serviço concluído pelo técnico, ainda não validado.';
  end if;

  update servicos set status = 'cancelado' where id = p_servico_id;

  insert into historico (chamado_id, evento, descricao, criado_por)
  values (v_chamado_id, 'servico_recusado', p_motivo, auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) fn_reportar_pendencia_material — técnico reporta que não conseguiu
--    concluir por falta de peça/material. Mesmo padrão de fn_concluir_servico:
--    exige evidência real (foto tipo 'parcial'), revalidada no servidor.
-- -----------------------------------------------------------------------------
create or replace function fn_reportar_pendencia_material(p_servico_id uuid, p_descricao text)
returns void
language plpgsql
as $$
declare
  v_tecnico_id uuid;
  v_status     status_servico;
  v_chamado_id uuid;
  v_tem_foto   boolean;
begin
  select tecnico_id, status, chamado_id into v_tecnico_id, v_status, v_chamado_id
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_tecnico_id is distinct from auth.uid() then
    raise exception 'Esse serviço não é seu.';
  end if;
  if v_status <> 'em_execucao' then
    raise exception 'Só é possível reportar pendência de material num atendimento em execução.';
  end if;
  if p_descricao is null or btrim(p_descricao) = '' then
    raise exception 'Descreva o que já foi feito e o que está faltando.';
  end if;

  select exists (
    select 1 from evidencias where servico_id = p_servico_id and tipo = 'foto' and momento = 'parcial'
  ) into v_tem_foto;
  if not v_tem_foto then
    raise exception 'Anexe uma foto do que já foi feito antes de reportar a pendência.';
  end if;

  update servicos set status = 'cancelado' where id = p_servico_id;

  insert into historico (chamado_id, evento, descricao, criado_por)
  values (v_chamado_id, 'servico_pendente_material', p_descricao, auth.uid());
end;
$$;
