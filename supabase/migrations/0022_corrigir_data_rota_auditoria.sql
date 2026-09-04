-- =============================================================================
-- Fase 3 — Execução (correção de segurança, 20/08/2026)
--
-- Brecha encontrada em auditoria: `fn_corrigir_data_rota` (migration 0016)
-- trocava `rotas.data` sem gravar nada em `historico` — única função do
-- projeto que mexe em rota/serviço e não segue esse padrão (todas as
-- outras — fn_confirmar_rota, fn_iniciar_servico, fn_concluir_servico,
-- fn_validar_servico, fn_reagendar_servico — gravam evento em `historico`
-- por chamado). Na prática: um gerente podia corrigir a data de uma rota
-- (inclusive pra mascarar atraso, movendo a data pra "hoje") sem deixar
-- rastro nenhum, nem na tela do técnico, nem em `/validacao`, nem na busca
-- de chamados.
--
-- A regra de elegibilidade da 0016 não muda (só gerente, só data, só
-- enquanto nenhum serviço da rota saiu de 'planejado') — esta migration só
-- adiciona o registro em `historico`, um evento por chamado vinculado à
-- rota (via `servicos`), no mesmo formato usado pelas outras funções.
-- =============================================================================

create or replace function fn_corrigir_data_rota(p_rota_id uuid, p_nova_data date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tem_servico_iniciado boolean;
  v_data_antiga date;
  v_chamado_id uuid;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode corrigir a data de uma rota.';
  end if;

  select exists (
    select 1 from servicos where rota_id = p_rota_id and status <> 'planejado'
  ) into v_tem_servico_iniciado;

  if v_tem_servico_iniciado then
    raise exception 'Essa rota já tem serviço iniciado por um técnico — a data não pode mais ser corrigida.';
  end if;

  select data into v_data_antiga from rotas where id = p_rota_id;

  if v_data_antiga is null then
    raise exception 'Rota não encontrada.';
  end if;

  update rotas set data = p_nova_data where id = p_rota_id;

  for v_chamado_id in
    select distinct chamado_id from servicos where rota_id = p_rota_id
  loop
    insert into historico (chamado_id, evento, descricao, criado_por)
    values (
      v_chamado_id,
      'rota_data_corrigida',
      format('Data da rota corrigida de %s para %s.', to_char(v_data_antiga, 'DD/MM/YYYY'), to_char(p_nova_data, 'DD/MM/YYYY')),
      auth.uid()
    );
  end loop;
end;
$$;
