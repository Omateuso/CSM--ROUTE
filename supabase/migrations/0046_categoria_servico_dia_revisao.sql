-- =============================================================================
-- Categoria do serviço: "concluir hoje" vs "revisão técnica" (pedido do
-- usuário, 11/09/2026)
--
-- Ao montar a rota, o gerente escolhe QUAIS chamados de cada RT o técnico
-- precisa CONCLUIR no dia. Os demais chamados elegíveis da MESMA RT não são
-- excluídos — continuam ganhando um `servico` normalmente (o técnico ainda
-- vai até a casa e vê o chamado), só nascem marcados como "revisão técnica":
-- o técnico passa o olho, sem a mesma cobrança de fechar aquele chamado hoje.
--
-- Diferente da `0033` (seleção manual de chamados, revertida em 09/09/2026):
-- lá, o chamado fora da lista simplesmente não ganhava serviço nenhum — o
-- técnico nunca via. Aqui NENHUM chamado elegível fica de fora; a escolha do
-- gerente decide só a CATEGORIA.
-- =============================================================================

alter table servicos
  add column categoria text not null default 'concluir_hoje'
    check (categoria in ('concluir_hoje', 'revisao_tecnica'));

comment on column servicos.categoria is
  'Escolhida pelo gerente ao confirmar a rota (fn_confirmar_rota, p_chamados_dia). '
  'concluir_hoje é a ação esperada no dia; revisao_tecnica é o chamado que o técnico '
  'só passa o olho, sem cobrança de conclusão no dia. Serviço criado por qualquer '
  'outro caminho (chamado que chega depois via fn_atualizar_servicos_rota, '
  'reexecução, urgência) nasce concluir_hoje — é o valor padrão da coluna.';

-- Assinatura muda (novo parâmetro), então precisa dropar antes de recriar
-- (mesmo caso da 0007/0014/0033).
drop function if exists fn_confirmar_rota(date, uuid, uuid[], uuid[], uuid[]);

create or replace function fn_confirmar_rota(
  p_data          date,
  p_equipe_id     uuid,
  p_rt_ids        uuid[],
  p_tecnico_ids   uuid[],
  p_chamados_dia  uuid[] default null
) returns uuid
language plpgsql
as $$
declare
  v_rota_id       uuid;
  v_regiao_id     uuid;
  v_rt_id         uuid;
  v_tecnico_id    uuid;
  v_tecnico_ok    boolean;
  v_chamado_id    uuid;
  v_ordem         integer := 1;
  v_categorizado  boolean;
begin
  if p_rt_ids is null or array_length(p_rt_ids, 1) is null or array_length(p_rt_ids, 1) = 0 then
    raise exception 'Informe pelo menos uma RT.';
  end if;

  if p_tecnico_ids is null or array_length(p_tecnico_ids, 1) is distinct from array_length(p_rt_ids, 1) then
    raise exception 'Informe um técnico responsável para cada RT da rota.';
  end if;

  -- NULL = comportamento de sempre (todo chamado elegível nasce
  -- concluir_hoje — é o que qualquer chamada antiga a esta função, sem o
  -- parâmetro novo, continua produzindo). Lista informada — mesmo vazia —
  -- decide a categoria explicitamente: um chamado dentro dela é
  -- concluir_hoje, qualquer outro elegível da rota é revisao_tecnica. Lista
  -- vazia é uma escolha válida (o gerente pode querer que o técnico só
  -- revise tudo nessa rota, sem nenhum chamado pra fechar hoje) — ao
  -- contrário da 0033, aqui não há "leva todos" implícito pra proteger, já
  -- que a lista nunca tira ninguém do serviço.
  v_categorizado := p_chamados_dia is not null;

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
    -- Todo elegível ganha serviço, sempre — a escolha do gerente (abaixo)
    -- decide só a categoria dele, nunca se ele entra ou não.
    for v_chamado_id in
      select c.id from chamados c
      where c.rt_id = v_rt_id
        and c.status not in ('finalizado', 'cancelado')
        and not exists (
          select 1 from servicos sv where sv.chamado_id = c.id and sv.status <> 'cancelado'
        )
    loop
      insert into servicos (rota_id, chamado_id, rt_id, tecnico_id, status, categoria)
      values (
        v_rota_id, v_chamado_id, v_rt_id, v_tecnico_id, 'planejado',
        case
          when not v_categorizado then 'concluir_hoje'
          when v_chamado_id = any (p_chamados_dia) then 'concluir_hoje'
          else 'revisao_tecnica'
        end
      );

      insert into historico (chamado_id, evento, descricao, criado_por)
      values (
        v_chamado_id,
        'servico_planejado',
        case
          when v_categorizado and not (v_chamado_id = any (p_chamados_dia))
            then 'Incluído na rota confirmada — para revisão técnica (não é pra concluir hoje).'
          else 'Incluído na rota confirmada — para concluir hoje.'
        end,
        auth.uid()
      );
    end loop;
  end loop;

  return v_rota_id;
end;
$$;
