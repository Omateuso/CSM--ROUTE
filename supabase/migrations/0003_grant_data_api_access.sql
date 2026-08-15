-- =============================================================================
-- Fase 1 — Base Operacional
-- As tabelas criadas pela 0001/0002 ficaram com RLS habilitado e policies
-- corretas, mas SEM os GRANTs de tabela que o PostgREST (Data API) exige pra
-- sequer considerar a tabela alcançável — RLS controla quais LINHAS uma role
-- vê, GRANT controla se a role alcança a tabela. Sem o GRANT, toda
-- select/insert falha com "permission denied for table X" (42501), mesmo
-- para service_role. Detectado ao rodar scripts/seed-test-users.mjs: todas
-- as tabelas do schema public retornavam esse erro.
--
-- Esta migration: (1) concede acesso explícito às tabelas já criadas, e
-- (2) ajusta os privilégios padrão do schema public para que migrations
-- futuras (0004+) não caiam na mesma armadilha.
-- =============================================================================

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
