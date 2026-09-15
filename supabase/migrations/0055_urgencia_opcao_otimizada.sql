-- =============================================================================
-- Terceira opção de despacho na Central de Urgências: "Otimizar para a rota
-- atual" (pedido do usuário, 15/09/2026) — testa TODOS os intervalos entre
-- as paradas restantes da rota (não só logo depois da próxima parada, como
-- "inserção no meio" já faz hoje) e recomenda o ponto de menor custo
-- (inserção mais barata — cálculo em lib/routing/urgencia-impacto.ts,
-- calcularMelhorInsercao, sem mudança nenhuma de schema).
--
-- `opcao_escolhida` é TEXT+CHECK (0027), não um enum de verdade — dá pra
-- ampliar a constraint e a função na MESMA migration sem a restrição de
-- transação que enums têm (diferente da 0053/0054, que precisaram de dois
-- arquivos).
--
-- Decisão confirmada com o usuário antes de codar: essa opção NÃO reordena
-- fisicamente `rota_rts.ordem` — só recomenda o melhor ponto pro gerente
-- decidir, e o mecanismo de gravação continua o mesmo de sempre (anexa ao
-- FIM da rota, exatamente como "inserção no meio" e "fim de rota" já
-- fazem). A ordem real de navegação do técnico já é recalculada ao vivo
-- pelo botão "Abrir rota no Google Maps" (lib/routing/otimizar-visita.ts,
-- 15/09/2026), então o resultado prático já sai correto sem precisar
-- renumerar nada aqui — "rota confirmada não reordena fisicamente" continua
-- valendo.
-- =============================================================================

alter table urgencias drop constraint urgencias_opcao_escolhida_check;
alter table urgencias add constraint urgencias_opcao_escolhida_check
  check (opcao_escolhida in ('insercao_rota', 'fim_de_rota', 'otimizado', 'outra_equipe', 'avulsa'));

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
  else
    if p_rota_id is null then
      raise exception 'Selecione a rota que vai receber a urgência.';
    end if;

    select id into v_rota_id from rotas
    where id = p_rota_id and data = current_date and status = 'confirmada';
    if v_rota_id is null then
      raise exception 'A rota selecionada não é uma rota confirmada de hoje.';
    end if;

    select coalesce(max(ordem), 0) + 1 into v_proxima_ordem from rota_rts where rota_id = v_rota_id;
  end if;

  insert into rota_rts (rota_id, rt_id, ordem, tecnico_id)
  values (v_rota_id, v_rt_id, v_proxima_ordem, p_tecnico_id);

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
