-- =============================================================================
-- Fase 1 — Base Operacional
-- Fecha duas lacunas deixadas pela 0001:
--   1. zonas/regioes/equipes/sla_regras não tinham RLS habilitado, e nenhuma
--      tabela tinha policy de INSERT/UPDATE — ou seja, nenhuma tela de
--      cadastro conseguiria gravar dados via client autenticado.
--   2. As policies de SELECT da 0001 usam `auth.role() = 'authenticated'`,
--      padrão deprecado pelo Supabase: quebra silenciosamente se o projeto
--      ativar login anônimo no futuro (usuário anônimo também carrega a role
--      Postgres 'authenticated'). O padrão atual é `to authenticated`.
-- Escrita em RTs, zonas/regiões e chamados fica restrita ao perfil `gerente`
-- (decisão confirmada com o usuário em 2026-08-15).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) CORRIGIR policies de SELECT da 0001 que usam o padrão deprecado
-- -----------------------------------------------------------------------------
drop policy "rts_select_authenticated"       on rts;
drop policy "chamados_select_authenticated"  on chamados;
drop policy "rotas_select_authenticated"     on rotas;
drop policy "rota_rts_select_authenticated"  on rota_rts;
drop policy "historico_select_authenticated" on historico;
drop policy "validacoes_select_authenticated" on validacoes;

create policy "rts_select_authenticated"       on rts        for select to authenticated using (true);
create policy "chamados_select_authenticated"  on chamados   for select to authenticated using (true);
create policy "rotas_select_authenticated"     on rotas      for select to authenticated using (true);
create policy "rota_rts_select_authenticated"  on rota_rts   for select to authenticated using (true);
create policy "historico_select_authenticated" on historico  for select to authenticated using (true);
create policy "validacoes_select_authenticated" on validacoes for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- 2) HABILITAR RLS nas tabelas que ficaram de fora da 0001
-- -----------------------------------------------------------------------------
alter table zonas      enable row level security;
alter table regioes    enable row level security;
alter table equipes    enable row level security;
alter table sla_regras enable row level security;

-- -----------------------------------------------------------------------------
-- 3) LEITURA — qualquer usuário autenticado (mesmo padrão do restante do
-- schema). equipes e sla_regras ainda não têm tela na Fase 1, mas ficam com
-- RLS + select desde já em vez de expostas sem policy nenhuma.
-- -----------------------------------------------------------------------------
create policy "zonas_select_authenticated"      on zonas      for select to authenticated using (true);
create policy "regioes_select_authenticated"    on regioes    for select to authenticated using (true);
create policy "equipes_select_authenticated"    on equipes    for select to authenticated using (true);
create policy "sla_regras_select_authenticated" on sla_regras for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- 4) ESCRITA — só gerente. Cobre as telas de cadastro da Fase 1: zonas/
-- regiões, RTs e chamados (entrada manual).
-- -----------------------------------------------------------------------------
create policy "zonas_insert_gerente" on zonas for insert
  to authenticated with check (fn_current_role() = 'gerente');
create policy "zonas_update_gerente" on zonas for update
  to authenticated using (fn_current_role() = 'gerente') with check (fn_current_role() = 'gerente');
create policy "zonas_delete_gerente" on zonas for delete
  to authenticated using (fn_current_role() = 'gerente');

create policy "regioes_insert_gerente" on regioes for insert
  to authenticated with check (fn_current_role() = 'gerente');
create policy "regioes_update_gerente" on regioes for update
  to authenticated using (fn_current_role() = 'gerente') with check (fn_current_role() = 'gerente');
create policy "regioes_delete_gerente" on regioes for delete
  to authenticated using (fn_current_role() = 'gerente');

create policy "rts_insert_gerente" on rts for insert
  to authenticated with check (fn_current_role() = 'gerente');
create policy "rts_update_gerente" on rts for update
  to authenticated using (fn_current_role() = 'gerente') with check (fn_current_role() = 'gerente');
-- sem policy de delete: inativação é via `rts.ativo = false` (update), não hard delete.

create policy "chamados_insert_gerente" on chamados for insert
  to authenticated with check (fn_current_role() = 'gerente');
create policy "chamados_update_gerente" on chamados for update
  to authenticated using (fn_current_role() = 'gerente') with check (fn_current_role() = 'gerente');
-- sem policy de delete: ciclo de vida do chamado é via `status` ('cancelado' inclusive), não hard delete.
