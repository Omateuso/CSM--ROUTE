-- =============================================================================
-- Remover QUALQUER parada de uma rota confirmada (pedido do usuário,
-- 18/09/2026, logo depois da 0062: "dê a opção de remover qualquer uma").
--
-- A 0062 recusava remover parada com atendimento iniciado e a última RT da
-- rota. As duas travas caem, com estas garantias no lugar:
--
--   * Serviço que AINDA NÃO FOI CONCLUÍDO (planejado, em_deslocamento,
--     em_execucao, em_revisao) é cancelado — o chamado volta a ficar
--     elegível pra próxima rota, e o histórico do chamado registra o motivo
--     (`servico_removido_rota`). Execuções/evidências parciais ficam
--     gravadas, ligadas ao serviço cancelado.
--   * Serviço JÁ CONCLUÍDO pelo técnico (concluido_tecnico,
--     aguardando_validacao) ou VALIDADO não é tocado: é trabalho que
--     aconteceu, precisa continuar na Validação/histórico. A parada sai da
--     lista da rota (`rota_rts`), o serviço continua apontando pra rota.
--     "Concluído pelo técnico ≠ validado" segue intacto.
--   * Se depois da remoção a rota não tiver mais nenhuma parada nem nenhum
--     serviço que tenha acontecido, ela vira `cancelada` (rota sem parada
--     não é rota). Se sobrou serviço concluído/validado, a rota fica.
--
-- Substitui a função da 0062 (create or replace, mesma assinatura); a
-- fn_adicionar_parada_rota não muda.
-- =============================================================================

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
  v_chamado_id  uuid;
  v_cancelados  integer := 0;
  v_restantes   integer;
  v_ativos      integer;
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

  -- Cancela o que ainda não foi concluído; o que já foi, fica.
  for v_chamado_id in
    select chamado_id from servicos
    where rota_id = p_rota_id and rt_id = p_rt_id
      and status in ('planejado', 'em_deslocamento', 'em_execucao', 'em_revisao')
  loop
    insert into historico (chamado_id, evento, descricao, criado_por)
    values (v_chamado_id, 'servico_removido_rota', btrim(p_motivo), auth.uid());
    v_cancelados := v_cancelados + 1;
  end loop;

  update servicos set status = 'cancelado'
  where rota_id = p_rota_id and rt_id = p_rt_id
    and status in ('planejado', 'em_deslocamento', 'em_execucao', 'em_revisao');

  delete from rota_rts_tecnicos where rota_id = p_rota_id and rt_id = p_rt_id;
  delete from rota_rts where rota_id = p_rota_id and rt_id = p_rt_id;

  -- Compacta a ordem: quem vinha depois sobe um degrau.
  update rota_rts set ordem = ordem - 1 where rota_id = p_rota_id and ordem > v_ordem;

  -- Rota sem parada e sem nenhum serviço que tenha acontecido vira
  -- cancelada. Se sobrou serviço concluído/validado, a rota fica como está
  -- (confirmada, sem paradas): é registro de trabalho feito, não lixo.
  select count(*) into v_restantes from rota_rts where rota_id = p_rota_id;
  select count(*) into v_ativos from servicos
  where rota_id = p_rota_id and status <> 'cancelado';
  if v_restantes = 0 and v_ativos = 0 then
    update rotas set status = 'cancelada' where id = p_rota_id;
  end if;

  return v_cancelados;
end;
$$;

-- Depois de rodar no SQL Editor: notify pgrst, 'reload schema';
