-- =============================================================================
-- Evolução para plataforma operacional — Fase 6 (seções 4/8), 09/09/2026
--
-- "Recusar" vira "Solicitar correção" — só reframe (decisão do usuário).
-- O EFEITO DE BANCO não muda: um serviço `concluido_tecnico` volta a
-- `cancelado`, o chamado libera pro pool e reentra numa rota nova como
-- "↩ Retorno" + "Tentativa anterior" (Fase 1). O que muda:
--   - a função troca de nome (`fn_recusar_servico` -> `fn_solicitar_correcao`)
--     pra bater com a UI;
--   - o evento de histórico passa a ser `servico_correcao_solicitada`
--     (o nome antigo `servico_recusado` fica no mapa de labels do
--     `historico-chamado.tsx` só pros registros já gravados);
--   - as mensagens de erro usam a linguagem de "correção", não de "recusa".
--
-- Guard com `<> 'gerente'` (não `is distinct from`) mantido igual à 0025 —
-- `fn_current_role()` não retorna null pra sessão autenticada.
-- =============================================================================

drop function if exists fn_recusar_servico(uuid, text);

create or replace function fn_solicitar_correcao(p_servico_id uuid, p_motivo text)
returns void
language plpgsql
as $$
declare
  v_status     status_servico;
  v_chamado_id uuid;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode solicitar correção de um serviço.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Descreva o que precisa ser corrigido.';
  end if;

  select status, chamado_id into v_status, v_chamado_id
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_status <> 'concluido_tecnico' then
    raise exception 'Só dá pra solicitar correção de um serviço concluído pelo técnico, ainda não validado.';
  end if;

  update servicos set status = 'cancelado' where id = p_servico_id;

  insert into historico (chamado_id, evento, descricao, criado_por)
  values (v_chamado_id, 'servico_correcao_solicitada', p_motivo, auth.uid());
end;
$$;
