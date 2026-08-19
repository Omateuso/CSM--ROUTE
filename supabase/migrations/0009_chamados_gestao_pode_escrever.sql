-- =============================================================================
-- Fase 1 — Base Operacional (B3, Chamados)
-- Chamados passam a poder ser criados/editados também pelo perfil `gestao`,
-- além do `gerente` (que já tinha essa permissão desde a 0002). Decisão do
-- usuário em 16/08/2026: no fluxo real, quem abre um chamado é o
-- cliente/CAPS no TomTicket — o gerente não deveria precisar originar
-- chamados manualmente no dia a dia. A exceção é um membro da gestão em
-- visita a uma RT, que pode identificar um problema in loco e já registrar
-- o chamado no sistema na hora.
--
-- Aditivo, não substitui as policies de `gerente` da 0002 (ao contrário da
-- 0006, que trocou a permissão de RTs de gerente pra gestão) — o gerente
-- continua com a permissão no banco. A tela do gerente só desabilita o
-- botão "+ Novo chamado" na UI por ora (feature em avaliação pela gestão
-- antes de virar fluxo confirmado) — ver Atualizações_futuras.md.
--
-- Policies de RLS permissivas pra um mesmo comando se combinam com OR, então
-- basta adicionar as novas pra `gestao` sem tocar nas de `gerente`.
-- =============================================================================

create policy "chamados_insert_gestao" on chamados for insert
  to authenticated with check (fn_current_role() = 'gestao');

create policy "chamados_update_gestao" on chamados for update
  to authenticated using (fn_current_role() = 'gestao') with check (fn_current_role() = 'gestao');
