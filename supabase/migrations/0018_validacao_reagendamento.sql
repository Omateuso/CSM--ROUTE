-- =============================================================================
-- Fase 4, Parte A — Validação + reagendamento (fundação de dados)
--
-- Problema real que já existia silenciosamente: uma vez que um `servico` é
-- criado pra um chamado, `fn_confirmar_rota` (0015) nunca mais oferece esse
-- chamado numa rota futura — a checagem "ainda não existe serviço" não
-- distingue "nunca foi feito" de "ficou travado sem ninguém terminar". Se um
-- técnico não chega a atender um serviço planejado num dia, hoje ele fica
-- preso pra sempre. Reagendar resolve isso: cancela o serviço travado sem
-- tocar em `chamados.status` (continua sendo só espelho do TomTicket — regra
-- confirmada na 0015), e `fn_confirmar_rota` passa a ignorar serviço
-- `cancelado` na checagem de duplicata — o chamado volta a ser candidato
-- normal na próxima rota que incluir aquela RT.
--
-- Validação fecha o pipeline (CLAUDE.md: "Só o gerente, ao validar, fecha o
-- ciclo" — `concluido_tecnico` != `finalizado administrativamente`).
-- Restrita a `gerente` (não `gestao`): a persona gestão é somente-leitura no
-- sistema fora das exceções explícitas de cadastro (RTs, zonas/regiões) —
-- validar/reagendar serviço não é uma delas. Mesmo padrão de
-- fn_iniciar_servico/fn_concluir_servico: o RLS de `servicos`/`validacoes`
-- (0001) já é permissivo o bastante para gerente/gestão (ponto de partida
-- "refinar por tela conforme a Fase 3/4 avançarem"), a função é quem garante
-- a regra de negócio de verdade — mesma convenção já usada nas outras
-- funções de transição de status deste projeto.
-- =============================================================================

-- Novo status: serviço planejado/em_execucao que não vai ser concluído por
-- aquele técnico/rota (reagendamento). Não é atingido por nenhuma função
-- além de fn_reagendar_servico.
alter type status_servico add value if not exists 'cancelado';

-- -----------------------------------------------------------------------------
-- 1) fn_validar_servico — único jeito suportado de fechar o ciclo
--    (concluido_tecnico -> validado). Observação é opcional (a obrigatória
--    já foi capturada na conclusão do técnico via `conclusoes`).
-- -----------------------------------------------------------------------------
create or replace function fn_validar_servico(p_servico_id uuid, p_observacao text default null)
returns void
language plpgsql
as $$
declare
  v_status     status_servico;
  v_chamado_id uuid;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode validar um serviço.';
  end if;

  select status, chamado_id into v_status, v_chamado_id
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_status <> 'concluido_tecnico' then
    raise exception 'Só é possível validar um serviço concluído pelo técnico.';
  end if;

  update servicos set status = 'validado' where id = p_servico_id;

  insert into validacoes (servico_id, validado_por, observacao)
  values (p_servico_id, auth.uid(), nullif(btrim(coalesce(p_observacao, '')), ''));

  insert into historico (chamado_id, evento, descricao, criado_por)
  values (v_chamado_id, 'servico_validado', 'Gerente validou o atendimento.', auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) fn_reagendar_servico — cancela um serviço planejado/em_execucao que não
--    vai ser concluído (técnico não chegou a ir, ou ficou parado sem
--    concluir). Não toca em `chamados.status`. Motivo é obrigatório —
--    registrado em `historico` pra ficar visível na linha do tempo do
--    chamado (Parte E da Fase 4).
-- -----------------------------------------------------------------------------
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

  insert into historico (chamado_id, evento, descricao, criado_por)
  values (v_chamado_id, 'servico_reagendado', p_motivo, auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) fn_confirmar_rota — ajuste: serviço `cancelado` não conta mais como
--    "já capturado" na checagem de duplicata, então o chamado volta a ser
--    candidato normal na próxima rota que incluir aquela RT.
-- -----------------------------------------------------------------------------
create or replace function fn_confirmar_rota(
  p_data        date,
  p_equipe_id   uuid,
  p_rt_ids      uuid[],
  p_tecnico_ids uuid[]
) returns uuid
language plpgsql
as $$
declare
  v_rota_id    uuid;
  v_regiao_id  uuid;
  v_rt_id      uuid;
  v_tecnico_id uuid;
  v_tecnico_ok boolean;
  v_chamado_id uuid;
  v_ordem      integer := 1;
begin
  if p_rt_ids is null or array_length(p_rt_ids, 1) is null or array_length(p_rt_ids, 1) = 0 then
    raise exception 'Informe pelo menos uma RT.';
  end if;

  if p_tecnico_ids is null or array_length(p_tecnico_ids, 1) is distinct from array_length(p_rt_ids, 1) then
    raise exception 'Informe um técnico responsável para cada RT da rota.';
  end if;

  select regiao_id into v_regiao_id from rts where id = p_rt_ids[1];
  if v_regiao_id is null then
    raise exception 'RT inválida: %', p_rt_ids[1];
  end if;

  insert into rotas (data, regiao_id, equipe_id, responsavel_id, status, confirmada_em)
  values (p_data, v_regiao_id, p_equipe_id, auth.uid(), 'confirmada', now())
  returning id into v_rota_id;

  for i in 1..array_length(p_rt_ids, 1) loop
    v_rt_id := p_rt_ids[i];
    v_tecnico_id := p_tecnico_ids[i];

    if v_tecnico_id is null then
      raise exception 'Selecione um técnico para todas as RTs da rota.';
    end if;

    select exists (
      select 1 from profiles
      where id = v_tecnico_id and role = 'tecnico' and ativo = true and equipe_id = p_equipe_id
    ) into v_tecnico_ok;

    if not v_tecnico_ok then
      raise exception 'Técnico inválido para a RT %: precisa ser um técnico ativo da equipe selecionada.', v_rt_id;
    end if;

    insert into rota_rts (rota_id, rt_id, ordem, tecnico_id) values (v_rota_id, v_rt_id, v_ordem, v_tecnico_id);
    v_ordem := v_ordem + 1;

    -- elegível = ainda não fechado no TomTicket (aberto/em_andamento contam
    -- os dois — 0015) E ainda não tem `servico` não-cancelado gerado antes
    -- (um `servico` cancelado por reagendamento não bloqueia mais o
    -- chamado de voltar a ser candidato).
    for v_chamado_id in
      select c.id from chamados c
      where c.rt_id = v_rt_id
        and c.status not in ('finalizado', 'cancelado')
        and not exists (
          select 1 from servicos sv where sv.chamado_id = c.id and sv.status <> 'cancelado'
        )
    loop
      insert into servicos (rota_id, chamado_id, rt_id, tecnico_id, status)
      values (v_rota_id, v_chamado_id, v_rt_id, v_tecnico_id, 'planejado');

      insert into historico (chamado_id, evento, descricao, criado_por)
      values (v_chamado_id, 'servico_planejado', 'Incluído na rota confirmada — técnico responsável definido.', auth.uid());
    end loop;
  end loop;

  return v_rota_id;
end;
$$;
