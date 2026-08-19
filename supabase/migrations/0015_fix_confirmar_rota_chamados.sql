-- =============================================================================
-- Fase 3 — Execução (correção pós-teste real, 18/08/2026)
--
-- Bug real encontrado testando com dados reais: `fn_confirmar_rota` (0014)
-- só criava `servicos` pra chamados com status = 'aberto'. Mas os dados
-- importados do TomTicket usam 'em_andamento' pra praticamente todo chamado
-- não fechado ainda (mesma convenção que o dashboard já usa — ver
-- `STATUS_ABERTO` em (gerente)/dashboard/page.tsx: "'Aberto' pro propósito
-- do dashboard... cobre os dois status que o import real usa hoje"). Uma
-- rota confirmada com SRT 71/SRT 5 (Abolição) gerou ZERO serviços porque
-- todos os chamados de lá já vinham 'em_andamento' do import — o técnico
-- ficou sem nada na tela, mesmo tendo sido atribuído à parada.
--
-- Causa raiz mais funda: a 0014 também tentava usar `chamados.status` como
-- sinalizador de "já capturado numa rota" (fazia UPDATE pra 'em_andamento'
-- ao confirmar). Isso conflita com o significado que `chamados.status` já
-- tem (espelho do TomTicket) — errado sobrescrever esse campo pra guardar
-- um estado que é interno desta aplicação. O controle de "já foi capturado
-- antes, não duplicar" passa a usar a existência de `servicos` (nossa
-- própria fonte de verdade), não mais o status do chamado.
-- =============================================================================

-- Técnico responsável por cada PARADA da rota — até aqui só existia
-- implicitamente em `servicos.tecnico_id`, então uma RT sem chamado
-- elegível (ex.: nenhum aberto/em_andamento) perdia essa informação por
-- completo (nenhum `servico` era criado pra guardar quem foi escalado).
-- Nullable de propósito: rotas confirmadas antes desta migration não têm
-- como saber retroativamente quem foi escalado — não inventar esse dado.
alter table rota_rts add column tecnico_id uuid references profiles(id) on delete restrict;

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

    -- elegível = ainda não fechado no TomTicket (não é sobre o status
    -- exato 'aberto' vs 'em_andamento', os dois contam — mesma convenção
    -- do dashboard) E ainda não tem nenhum `servico` gerado antes (evita
    -- duplicar trabalho se o mesmo chamado já foi capturado numa rota
    -- anterior). `chamados.status` nunca é escrito aqui — continua sendo
    -- só o espelho do TomTicket.
    for v_chamado_id in
      select c.id from chamados c
      where c.rt_id = v_rt_id
        and c.status not in ('finalizado', 'cancelado')
        and not exists (select 1 from servicos sv where sv.chamado_id = c.id)
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
