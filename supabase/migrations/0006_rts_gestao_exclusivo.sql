-- =============================================================================
-- Fase 1 — Base Operacional
-- Mudança de permissão: cadastro de RT (criar, editar dados básicos,
-- trocar endereço) passa a ser exclusivo do perfil `gestao`. `gerente` e
-- `tecnico` ficam somente-leitura em `rts`/`rt_enderecos` (as policies de
-- SELECT já eram "authenticated" e continuam assim, sem mudança).
--
-- fn_criar_rt_com_endereco e fn_trocar_endereco_rt (migration 0005) não
-- precisam mudar — rodam security invoker, então já herdam a RLS da
-- tabela automaticamente. Só a policy muda.
--
-- Zonas/regiões e chamados NÃO mudam — continuam exclusivos do gerente.
-- =============================================================================

drop policy "rts_insert_gerente" on rts;
drop policy "rts_update_gerente" on rts;

create policy "rts_insert_gestao" on rts for insert
  to authenticated with check (fn_current_role() = 'gestao');
create policy "rts_update_gestao" on rts for update
  to authenticated using (fn_current_role() = 'gestao') with check (fn_current_role() = 'gestao');

drop policy "rt_enderecos_insert_gerente" on rt_enderecos;
drop policy "rt_enderecos_update_gerente" on rt_enderecos;

create policy "rt_enderecos_insert_gestao" on rt_enderecos
  for insert to authenticated with check (fn_current_role() = 'gestao');

create policy "rt_enderecos_update_gestao" on rt_enderecos
  for update to authenticated
  using (fn_current_role() = 'gestao')
  with check (fn_current_role() = 'gestao');
