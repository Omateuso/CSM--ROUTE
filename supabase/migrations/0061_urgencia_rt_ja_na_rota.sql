-- =============================================================================
-- Corrige bug real: despachar uma urgência pra uma RT que JÁ é parada da rota
-- confirmada quebrava com violação de unicidade — `rota_rts` tem
-- `unique (rota_id, rt_id)` desde a 0001, e `fn_decidir_atendimento_urgencia`
-- (0027/0045/0055) sempre tentava inserir uma parada NOVA pra essa RT, sem
-- checar se ela já existia na rota escolhida.
--
-- Achado investigando um relato do usuário, 16/09/2026: ele estava na RT 67
-- e ia despachar uma urgência pra um chamado da RT 50 — que JÁ era parada
-- planejada daquela mesma rota (outro chamado, sem relação). O painel de
-- despacho mostrava corretamente "0.0 km" (a matemática de custo marginal já
-- estava certa — inserir ali não soma deslocamento extra, o técnico já ia
-- passar lá). Mas clicar em "Despachar técnico" teria falhado com
-- `duplicate key value violates unique constraint "rota_rts_rota_id_rt_id_key"`
-- assim que tentasse gravar — nunca chegou a essa etapa na sessão porque a
-- pergunta foi feita antes do clique.
--
-- Corrigido no mesmo padrão que `fn_programar_reexecucao` (0034) já usa pra
-- exatamente esse cenário ("A RT já é parada dessa rota?"): se a RT já está
-- na rota escolhida, reaproveita a parada existente (sem inserir de novo);
-- se a parada não tinha técnico definido (não deveria acontecer em rota
-- pós-0015, mas por segurança), assume o técnico escolhido pro despacho. Se
-- o técnico escolhido for DIFERENTE do já designado pra essa parada, ele
-- entra como técnico extra via `rota_rts_tecnicos` (0050) — assim os dois
-- enxergam/agem nos serviços daquela RT, em vez de um deles ficar sem acesso
-- ao próprio serviço que acabou de receber. Só o caminho 'avulsa' fica de
-- fora dessa checagem: ele sempre cria uma rota NOVA (insert em `rotas`
-- alguns comandos antes), então nunca pode colidir.
-- =============================================================================

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
  v_parada_tec    uuid;
  v_ja_parada     boolean;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode decidir o atendimento de uma urgência.';
  end if;
  if p_opcao not in ('insercao_rota', 'fim_de_rota', 'otimizado', 'outra_equipe', 'avulsa') then
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
    insert into rota_rts (rota_id, rt_id, ordem, tecnico_id)
    values (v_rota_id, v_rt_id, v_proxima_ordem, p_tecnico_id);
  else
    if p_rota_id is null then
      raise exception 'Selecione a rota que vai receber a urgência.';
    end if;

    select id into v_rota_id from rotas
    where id = p_rota_id and data = current_date and status = 'confirmada';
    if v_rota_id is null then
      raise exception 'A rota selecionada não é uma rota confirmada de hoje.';
    end if;

    -- A RT já é parada dessa rota? (unique (rota_id, rt_id) em rota_rts,
    -- 0001 — mesmo padrão de checagem da fn_programar_reexecucao, 0034.)
    select tecnico_id into v_parada_tec from rota_rts
    where rota_id = v_rota_id and rt_id = v_rt_id;
    v_ja_parada := found;

    if v_ja_parada then
      if v_parada_tec is null then
        update rota_rts set tecnico_id = p_tecnico_id
        where rota_id = v_rota_id and rt_id = v_rt_id;
      elsif v_parada_tec is distinct from p_tecnico_id then
        insert into rota_rts_tecnicos (rota_id, rt_id, tecnico_id)
        values (v_rota_id, v_rt_id, p_tecnico_id)
        on conflict (rota_id, rt_id, tecnico_id) do nothing;
      end if;
    else
      select coalesce(max(ordem), 0) + 1 into v_proxima_ordem from rota_rts where rota_id = v_rota_id;
      insert into rota_rts (rota_id, rt_id, ordem, tecnico_id)
      values (v_rota_id, v_rt_id, v_proxima_ordem, p_tecnico_id);
    end if;
  end if;

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
