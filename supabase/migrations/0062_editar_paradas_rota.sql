-- =============================================================================
-- Editar paradas de uma rota confirmada (pedido do usuário, 18/09/2026):
-- adicionar uma RT (endereço) à rota, ou tirar uma RT dela — sem cancelar e
-- montar tudo de novo.
--
-- Até aqui a composição de uma rota confirmada era imutável (0032: "mudar a
-- composição continua sendo cancelar e montar de novo"). As exceções que já
-- existiam eram cirúrgicas: trocar o técnico de uma parada (0031) e a Central
-- de Urgências inserir a RT de uma urgência numa rota de hoje (0055/0061).
-- Estas duas funções generalizam a segunda: o gerente escolhe a RT, o
-- técnico e quais chamados entram — mesma regra de elegibilidade de
-- fn_confirmar_rota (chamado não finalizado/cancelado, sem serviço ativo) e
-- mesma categoria (concluir hoje / revisão técnica) da 0046.
--
-- Regras (as mesmas do resto do fluxo, não flexibilizar sem confirmar):
--   * Só gerente. Só rota `confirmada`, com data hoje ou futura — rota
--     passada é histórico.
--   * Adicionar: a RT não pode já estar na rota (pra isso existe trocar
--     técnico / a Central de Urgências); precisa gerar pelo menos um serviço
--     — parada sem serviço é invisível pro técnico, que só enxerga
--     `servicos`. Entra no FIM da ordem; o gerente reordena no Google Maps
--     (rota otimizada), não aqui.
--   * Remover: só se nenhum serviço da parada saiu de `planejado` — parada
--     com atendimento iniciado é reagendada pela Validação/Pendências, não
--     apagada. Não pode ser a última RT da rota (aí é cancelar a rota, 0031,
--     que exige motivo e registra o evento certo). Os serviços planejados
--     viram `cancelado` (o chamado volta a ficar elegível pra próxima rota),
--     a ordem das paradas seguintes é compactada.
--   * Tudo fica no `historico` do chamado (eventos `servico_planejado` e
--     `servico_removido_rota`), com quem fez e o motivo.
--
-- security definer (como 0031): mexe em rota_rts/rota_rts_tecnicos/servicos
-- de uma vez, numa transação; a autorização é a checagem explícita de papel
-- na primeira linha, não a RLS de cada tabela.
-- =============================================================================

create or replace function fn_adicionar_parada_rota(
  p_rota_id     uuid,
  p_rt_id       uuid,
  p_tecnico_id  uuid,
  p_chamado_ids uuid[] default null,   -- null = todos os elegíveis da RT
  p_categoria   text default 'concluir_hoje'
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rota        rotas%rowtype;
  v_tecnico_ok  boolean;
  v_ordem       integer;
  v_chamado_id  uuid;
  v_criados     integer := 0;
begin
  if fn_current_role() is distinct from 'gerente' then
    raise exception 'Só o gerente pode adicionar uma parada à rota.';
  end if;
  if p_categoria not in ('concluir_hoje', 'revisao_tecnica') then
    raise exception 'Categoria inválida.';
  end if;

  select * into v_rota from rotas where id = p_rota_id;
  if not found then
    raise exception 'Rota não encontrada.';
  end if;
  if v_rota.status <> 'confirmada' then
    raise exception 'Só dá pra editar as paradas de uma rota confirmada.';
  end if;
  if v_rota.data < current_date then
    raise exception 'Essa rota já passou — não dá mais pra mudar as paradas dela.';
  end if;

  if not exists (select 1 from rts where id = p_rt_id and ativo = true) then
    raise exception 'RT não encontrada ou inativa.';
  end if;
  if exists (select 1 from rota_rts where rota_id = p_rota_id and rt_id = p_rt_id) then
    raise exception 'Essa RT já está nesta rota. Pra mudar o técnico dela, use "trocar técnico".';
  end if;

  select exists (
    select 1 from profiles
    where id = p_tecnico_id and role = 'tecnico' and ativo = true and equipe_id = v_rota.equipe_id
  ) into v_tecnico_ok;
  if not v_tecnico_ok then
    raise exception 'Técnico inválido: precisa ser um técnico ativo da equipe desta rota.';
  end if;

  select coalesce(max(ordem), 0) + 1 into v_ordem from rota_rts where rota_id = p_rota_id;

  insert into rota_rts (rota_id, rt_id, ordem, tecnico_id)
  values (p_rota_id, p_rt_id, v_ordem, p_tecnico_id);
  insert into rota_rts_tecnicos (rota_id, rt_id, tecnico_id)
  values (p_rota_id, p_rt_id, p_tecnico_id)
  on conflict (rota_id, rt_id, tecnico_id) do nothing;

  -- Mesma elegibilidade de fn_confirmar_rota (0015/0018/0050). Se o gerente
  -- passou uma lista, ela só RESTRINGE — chamado fora da regra não entra
  -- mesmo que esteja na lista.
  for v_chamado_id in
    select c.id from chamados c
    where c.rt_id = p_rt_id
      and c.status not in ('finalizado', 'cancelado')
      and (p_chamado_ids is null or c.id = any (p_chamado_ids))
      and not exists (
        select 1 from servicos sv where sv.chamado_id = c.id and sv.status <> 'cancelado'
      )
  loop
    insert into servicos (rota_id, chamado_id, rt_id, tecnico_id, status, categoria)
    values (p_rota_id, v_chamado_id, p_rt_id, p_tecnico_id, 'planejado', p_categoria);

    insert into historico (chamado_id, evento, descricao, criado_por)
    values (
      v_chamado_id,
      'servico_planejado',
      case
        when p_categoria = 'revisao_tecnica'
          then 'Incluído na rota depois da confirmação (parada adicionada) — para revisão técnica.'
        else 'Incluído na rota depois da confirmação (parada adicionada) — para concluir hoje.'
      end,
      auth.uid()
    );
    v_criados := v_criados + 1;
  end loop;

  if v_criados = 0 then
    -- Aborta a transação inteira (rota_rts também volta): parada sem serviço
    -- não aparece pro técnico e só confundiria a lista do gerente.
    raise exception 'Essa RT não tem chamado em aberto disponível — nada pra atender nesta rota.';
  end if;

  return v_criados;
end;
$$;

create or replace function fn_remover_parada_rota(
  p_rota_id uuid,
  p_rt_id   uuid,
  p_motivo  text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rota        rotas%rowtype;
  v_ordem       integer;
  v_restantes   integer;
  v_chamado_id  uuid;
  v_cancelados  integer := 0;
begin
  if fn_current_role() is distinct from 'gerente' then
    raise exception 'Só o gerente pode remover uma parada da rota.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Informe o motivo da remoção.';
  end if;

  select * into v_rota from rotas where id = p_rota_id;
  if not found then
    raise exception 'Rota não encontrada.';
  end if;
  if v_rota.status <> 'confirmada' then
    raise exception 'Só dá pra editar as paradas de uma rota confirmada.';
  end if;
  if v_rota.data < current_date then
    raise exception 'Essa rota já passou — não dá mais pra mudar as paradas dela.';
  end if;

  select ordem into v_ordem from rota_rts where rota_id = p_rota_id and rt_id = p_rt_id;
  if not found then
    raise exception 'Essa RT não está nesta rota.';
  end if;

  select count(*) into v_restantes from rota_rts where rota_id = p_rota_id;
  if v_restantes <= 1 then
    raise exception 'Essa é a única RT da rota — pra desfazer a rota inteira, use "Cancelar rota".';
  end if;

  if exists (
    select 1 from servicos
    where rota_id = p_rota_id and rt_id = p_rt_id and status not in ('planejado', 'cancelado')
  ) then
    raise exception 'Essa parada já tem atendimento iniciado ou concluído — não dá pra removê-la. Reagende pela Validação/Pendências.';
  end if;

  for v_chamado_id in
    select chamado_id from servicos
    where rota_id = p_rota_id and rt_id = p_rt_id and status = 'planejado'
  loop
    insert into historico (chamado_id, evento, descricao, criado_por)
    values (v_chamado_id, 'servico_removido_rota', btrim(p_motivo), auth.uid());
    v_cancelados := v_cancelados + 1;
  end loop;

  update servicos set status = 'cancelado'
  where rota_id = p_rota_id and rt_id = p_rt_id and status = 'planejado';

  delete from rota_rts_tecnicos where rota_id = p_rota_id and rt_id = p_rt_id;
  delete from rota_rts where rota_id = p_rota_id and rt_id = p_rt_id;

  -- Compacta a ordem: quem vinha depois sobe um degrau.
  update rota_rts set ordem = ordem - 1 where rota_id = p_rota_id and ordem > v_ordem;

  return v_cancelados;
end;
$$;

-- Depois de rodar no SQL Editor: notify pgrst, 'reload schema';
