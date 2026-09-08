-- =============================================================================
-- Gerente escolhe QUAIS chamados o técnico vai cumprir (pedido do usuário, 08/09/2026)
--
-- Até aqui, confirmar uma rota levava TODOS os chamados elegíveis de cada RT —
-- tudo ou nada. Numa RT com 20 chamados abertos, o técnico recebia os 20, sem o
-- gerente poder dizer "hoje só esses três".
--
-- `p_chamado_ids` é OPCIONAL e o default preserva o comportamento antigo:
--   NULL  -> todos os elegíveis da RT (como sempre foi)
--   lista -> só os informados, E ainda assim filtrados pela MESMA regra de
--            elegibilidade. A lista restringe, nunca amplia: um chamado já
--            fechado ou já atendido em outra rota não entra só porque veio
--            marcado na tela.
--
-- Não conflita com a `0032` (chamado que chega depois entra sozinho na rota já
-- confirmada). São momentos diferentes: aqui o gerente escolhe o que existe
-- AGORA; lá o sistema completa com o que nasceu DEPOIS — que foi outro pedido
-- explícito do usuário.
--
-- Assinatura muda, então precisa dropar antes de recriar (mesmo caso da 0007 e
-- da 0014).
-- =============================================================================

drop function if exists fn_confirmar_rota(date, uuid, uuid[], uuid[]);

create or replace function fn_confirmar_rota(
  p_data        date,
  p_equipe_id   uuid,
  p_rt_ids      uuid[],
  p_tecnico_ids uuid[],
  p_chamado_ids uuid[] default null
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
  v_escolhidos boolean;
begin
  if p_rt_ids is null or array_length(p_rt_ids, 1) is null or array_length(p_rt_ids, 1) = 0 then
    raise exception 'Informe pelo menos uma RT.';
  end if;

  if p_tecnico_ids is null or array_length(p_tecnico_ids, 1) is distinct from array_length(p_rt_ids, 1) then
    raise exception 'Informe um técnico responsável para cada RT da rota.';
  end if;

  -- Lista vazia (não NULL) significa "o gerente desmarcou tudo" — é diferente
  -- de "não escolheu nada" e não pode virar silenciosamente "leva todos".
  v_escolhidos := p_chamado_ids is not null;
  if v_escolhidos and array_length(p_chamado_ids, 1) is null then
    raise exception 'Selecione ao menos um chamado para a rota.';
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
    -- os dois — 0015) E ainda não tem `servico` não-cancelado gerado antes.
    -- A escolha do gerente entra como filtro ADICIONAL, nunca como exceção.
    for v_chamado_id in
      select c.id from chamados c
      where c.rt_id = v_rt_id
        and c.status not in ('finalizado', 'cancelado')
        and not exists (
          select 1 from servicos sv where sv.chamado_id = c.id and sv.status <> 'cancelado'
        )
        and (not v_escolhidos or c.id = any (p_chamado_ids))
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
