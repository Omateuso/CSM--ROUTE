-- =============================================================================
-- Corrigir rota confirmada errada (pedido do usuário, 08/09/2026)
--
-- "Rota confirmada é histórico imutável" (regra da Parte C da Fase 2) continua
-- valendo como princípio, mas o usuário bateu no limite dela na prática: ao
-- confirmar uma rota com a equipe/RT errada, não havia NENHUMA forma de
-- corrigir — só a data (0016/0022). Um erro de clique virava trabalho errado
-- na tela do técnico, sem saída.
--
-- ABERTURA DELIBERADAMENTE ESTREITA, mesmo espírito da 0016:
--
--   1. CANCELAR a rota inteira — só enquanto NENHUM serviço saiu de
--      'planejado'. Não apaga nada: a rota vira `cancelada` e os serviços
--      também, o que devolve os chamados pro pool (fn_confirmar_rota ignora
--      serviço cancelado na checagem de duplicata, ver 0018). O histórico do
--      que aconteceu fica registrado.
--   2. TROCAR O TÉCNICO de uma parada — o erro mais comum e o menos
--      destrutivo de corrigir. Só enquanto aquela parada não começou.
--
-- O que continua IMPOSSÍVEL por aqui, de propósito: reescrever a composição da
-- rota (adicionar/remover RT, reordenar). Pra isso, cancela e monta de novo —
-- assim o que o técnico viu num momento nunca muda por baixo dele.
--
-- Guard de role com `is distinct from`, não `<>`: sem isso, `fn_current_role()`
-- NULL (chamador anônimo) passaria direto, porque `NULL <> 'gerente'` é NULL e
-- não TRUE. Foi a brecha real corrigida na 0029 — não repetir.
-- =============================================================================

create or replace function fn_cancelar_rota(p_rota_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tem_servico_iniciado boolean;
  v_existe               boolean;
  v_chamado_id           uuid;
begin
  if fn_current_role() is distinct from 'gerente' then
    raise exception 'Só o gerente pode cancelar uma rota.';
  end if;

  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Informe o motivo do cancelamento da rota.';
  end if;

  select exists (select 1 from rotas where id = p_rota_id) into v_existe;
  if not v_existe then
    raise exception 'Rota não encontrada.';
  end if;

  select exists (
    select 1 from servicos where rota_id = p_rota_id and status <> 'planejado'
  ) into v_tem_servico_iniciado;

  if v_tem_servico_iniciado then
    raise exception 'Essa rota já tem serviço iniciado por um técnico — não dá mais pra cancelar. Reagende os serviços individualmente.';
  end if;

  -- Um evento por chamado ANTES de cancelar, enquanto ainda dá pra listar.
  for v_chamado_id in
    select distinct chamado_id from servicos where rota_id = p_rota_id
  loop
    insert into historico (chamado_id, evento, descricao, criado_por)
    values (v_chamado_id, 'rota_cancelada', btrim(p_motivo), auth.uid());
  end loop;

  update servicos set status = 'cancelado' where rota_id = p_rota_id;
  update rotas    set status = 'cancelada' where id = p_rota_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Trocar o técnico de uma parada.
--
-- Atualiza os dois lugares que guardam essa informação: `rota_rts.tecnico_id`
-- (quem foi escalado, exibido no detalhe da rota) e `servicos.tecnico_id` (o
-- que faz o serviço aparecer na tela do técnico). Deixar um sem o outro faria a
-- tela da rota discordar da tela do técnico.
-- -----------------------------------------------------------------------------
create or replace function fn_trocar_tecnico_parada(p_rota_id uuid, p_rt_id uuid, p_tecnico_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role         user_role;
  v_tem_iniciado boolean;
  v_chamado_id   uuid;
begin
  if fn_current_role() is distinct from 'gerente' then
    raise exception 'Só o gerente pode trocar o técnico de uma parada.';
  end if;

  select role into v_role from profiles where id = p_tecnico_id;
  if v_role is distinct from 'tecnico' then
    raise exception 'O responsável por uma parada precisa ser um técnico.';
  end if;

  select exists (
    select 1 from servicos
    where rota_id = p_rota_id and rt_id = p_rt_id and status <> 'planejado'
  ) into v_tem_iniciado;

  if v_tem_iniciado then
    raise exception 'Essa parada já foi iniciada pelo técnico — não dá mais pra trocar o responsável.';
  end if;

  update rota_rts set tecnico_id = p_tecnico_id where rota_id = p_rota_id and rt_id = p_rt_id;
  if not found then
    raise exception 'Parada não encontrada nessa rota.';
  end if;

  update servicos set tecnico_id = p_tecnico_id
   where rota_id = p_rota_id and rt_id = p_rt_id and status = 'planejado';

  for v_chamado_id in
    select distinct chamado_id from servicos where rota_id = p_rota_id and rt_id = p_rt_id
  loop
    insert into historico (chamado_id, evento, descricao, criado_por)
    values (
      v_chamado_id,
      'tecnico_trocado',
      format('Responsável pela parada trocado para %s.',
             coalesce((select nome from profiles where id = p_tecnico_id), 'outro técnico')),
      auth.uid()
    );
  end loop;
end;
$$;
