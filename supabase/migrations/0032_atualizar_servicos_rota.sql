-- =============================================================================
-- Chamado novo alcança o técnico sem remontar a rota (pedido do usuário, 08/09/2026)
--
-- O problema, reproduzido com o chamado real #331166 (SRT 50): ele aparecia
-- pro gerente (que lê `chamados` direto) e NÃO pro técnico (que só enxerga
-- `servicos`). Motivo: `fn_confirmar_rota` cria os serviços com os chamados
-- elegíveis NO INSTANTE da confirmação. Chamado que nasce depois — e agora
-- nascem sozinhos, pela sincronização com o TomTicket (0030) — ficava fora da
-- rota já confirmada, invisível pra quem está em campo.
--
-- Esta função "completa" uma rota já confirmada: para cada RT dela, cria
-- serviço pros chamados que ficaram elegíveis depois. A regra de elegibilidade
-- é EXATAMENTE a mesma de `fn_confirmar_rota` (0015/0018) — chamado não
-- finalizado/cancelado e sem serviço ativo — pra não abrir uma segunda
-- definição de "chamado que precisa de atendimento" que possa divergir.
--
-- O que ela NÃO faz, de propósito: adicionar RT nova à rota. Só preenche as
-- paradas que o gerente já escolheu, com o técnico que ele já definiu ali.
-- Mudar a composição da rota continua sendo cancelar e montar de novo (0031).
-- =============================================================================

create or replace function fn_atualizar_servicos_rota(p_rota_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status     status_rota;
  v_rt_id      uuid;
  v_tecnico_id uuid;
  v_chamado_id uuid;
  v_criados    integer := 0;
begin
  -- Gerente pelo app, ou a própria sincronização rodando com service role
  -- (um cron não tem sessão de usuário). `auth.role()` é 'anon' pra quem chega
  -- sem credencial nenhuma, então a brecha da 0029 não se repete aqui.
  if fn_current_role() is distinct from 'gerente'
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Só o gerente pode atualizar os serviços de uma rota.';
  end if;

  select status into v_status from rotas where id = p_rota_id;
  if not found then
    raise exception 'Rota não encontrada.';
  end if;
  if v_status <> 'confirmada' then
    return 0;
  end if;

  for v_rt_id, v_tecnico_id in
    select rt_id, tecnico_id from rota_rts where rota_id = p_rota_id
  loop
    -- Parada sem técnico definido (rotas anteriores à 0015) fica de fora: criar
    -- serviço sem dono deixaria o chamado invisível do mesmo jeito.
    if v_tecnico_id is null then
      continue;
    end if;

    for v_chamado_id in
      select c.id from chamados c
      where c.rt_id = v_rt_id
        and c.status not in ('finalizado', 'cancelado')
        and not exists (
          select 1 from servicos sv where sv.chamado_id = c.id and sv.status <> 'cancelado'
        )
    loop
      insert into servicos (rota_id, chamado_id, rt_id, tecnico_id, status)
      values (p_rota_id, v_chamado_id, v_rt_id, v_tecnico_id, 'planejado');

      insert into historico (chamado_id, evento, descricao, criado_por)
      values (
        v_chamado_id,
        'servico_planejado',
        'Incluído numa rota já confirmada (chamado chegou depois da montagem).',
        auth.uid()
      );

      v_criados := v_criados + 1;
    end loop;
  end loop;

  return v_criados;
end;
$$;
