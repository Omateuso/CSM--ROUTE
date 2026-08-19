-- =============================================================================
-- Fase 2 — Rotas (Parte B, B5: confirmar rota do dia)
-- `rotas`/`rota_rts` só tinham policy de SELECT desde a 0001/0002 — nenhuma
-- tela conseguia gravar a rota confirmada ainda.
--
-- Escrita exclusiva de `gerente` (mesmo padrão de equipes/chamados). De
-- propósito, esta migration NÃO cria policy de UPDATE nem DELETE: "a rota
-- confirmada é um registro histórico" (regra do CLAUDE.md/plano-de-fases)
-- — depois de inserida, não pode ser reescrita nem apagada por aqui. Um
-- cancelamento (status = 'cancelada') é uma decisão da Parte C (tela
-- "Rotas Confirmadas"), que vai precisar de uma policy de UPDATE própria,
-- bem mais restrita (só o campo status, nunca RTs/ordem/equipe), quando
-- essa tela for construída — não antecipar aqui.
-- =============================================================================

create policy "rotas_insert_gerente" on rotas for insert
  to authenticated with check (fn_current_role() = 'gerente');

create policy "rota_rts_insert_gerente" on rota_rts for insert
  to authenticated with check (fn_current_role() = 'gerente');

-- -----------------------------------------------------------------------------
-- fn_confirmar_rota — grava rotas + rota_rts numa transação só (mesmo
-- padrão de fn_criar_rt_com_endereco/fn_trocar_endereco_rt, migration
-- 0005): sem isso, uma falha no segundo insert deixaria uma `rotas` órfã
-- sem nenhuma RT. security invoker (padrão) — herda a RLS das duas
-- policies acima automaticamente, não duplica a checagem de role aqui.
--
-- regiao_id da rota = região da primeira RT da lista. A rota pode
-- atravessar regiões (item 4 do spec — região não é barreira geográfica),
-- mas a coluna é NOT NULL e funciona como "âncora" da rota pra
-- relatório/histórico, não como um filtro rígido do conteúdo dela.
-- -----------------------------------------------------------------------------
create or replace function fn_confirmar_rota(
  p_data      date,
  p_equipe_id uuid,
  p_rt_ids    uuid[]
) returns uuid
language plpgsql
as $$
declare
  v_rota_id   uuid;
  v_regiao_id uuid;
  v_rt_id     uuid;
  v_ordem     integer := 1;
begin
  if p_rt_ids is null or array_length(p_rt_ids, 1) is null or array_length(p_rt_ids, 1) = 0 then
    raise exception 'Informe pelo menos uma RT.';
  end if;

  select regiao_id into v_regiao_id from rts where id = p_rt_ids[1];
  if v_regiao_id is null then
    raise exception 'RT inválida: %', p_rt_ids[1];
  end if;

  insert into rotas (data, regiao_id, equipe_id, responsavel_id, status, confirmada_em)
  values (p_data, v_regiao_id, p_equipe_id, auth.uid(), 'confirmada', now())
  returning id into v_rota_id;

  foreach v_rt_id in array p_rt_ids loop
    insert into rota_rts (rota_id, rt_id, ordem) values (v_rota_id, v_rt_id, v_ordem);
    v_ordem := v_ordem + 1;
  end loop;

  return v_rota_id;
end;
$$;
