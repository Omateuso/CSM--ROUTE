-- =============================================================================
-- Fase 1 (retrofit) — Zonas e regiões
-- Decisão do usuário em 17/08/2026: renomear/excluir zona ou região passa a
-- ser exclusivo do perfil `gestao` — mesmo raciocínio da migration 0006
-- (RTs): quem decide/valida a estrutura territorial "oficial" é a gestão,
-- não o operacional do dia a dia.
--
-- Criar zona/região continua com o `gerente` (não foi pedido pra mudar) —
-- por isso só as policies de UPDATE/DELETE trocam de dono aqui, INSERT
-- fica exatamente como estava desde a 0002. Isso deixa uma permissão
-- assimétrica de propósito: gerente cria, só gestão renomeia/apaga.
-- =============================================================================

drop policy "zonas_update_gerente" on zonas;
drop policy "zonas_delete_gerente" on zonas;

create policy "zonas_update_gestao" on zonas for update
  to authenticated using (fn_current_role() = 'gestao') with check (fn_current_role() = 'gestao');
create policy "zonas_delete_gestao" on zonas for delete
  to authenticated using (fn_current_role() = 'gestao');

drop policy "regioes_update_gerente" on regioes;
drop policy "regioes_delete_gerente" on regioes;

create policy "regioes_update_gestao" on regioes for update
  to authenticated using (fn_current_role() = 'gestao') with check (fn_current_role() = 'gestao');
create policy "regioes_delete_gestao" on regioes for delete
  to authenticated using (fn_current_role() = 'gestao');
