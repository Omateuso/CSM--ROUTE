-- =============================================================================
-- Fase 2 — Rotas (Parte A: Equipes e técnicos)
-- Duas lacunas de permissão encontradas ao revisar o schema antes de montar
-- a tela: `equipes` só tinha policy de SELECT (migration 0002) e `profiles`
-- não tinha NENHUMA policy de UPDATE — nem o gerente conseguia vincular um
-- técnico a uma equipe, que é literalmente um `update profiles set
-- equipe_id = ...`.
--
-- Escrita em equipes fica exclusiva do gerente (mesmo padrão de zonas —
-- persona "monta e confirma rotas"). gestão e técnico continuam
-- somente-leitura (policy de select já existia, sem mudança).
-- =============================================================================

create policy "equipes_insert_gerente" on equipes for insert
  to authenticated with check (fn_current_role() = 'gerente');

create policy "equipes_update_gerente" on equipes for update
  to authenticated using (fn_current_role() = 'gerente') with check (fn_current_role() = 'gerente');

-- sem policy de delete: inativação é via `equipes.ativo = false` (update),
-- mesmo padrão de rts.

-- -----------------------------------------------------------------------------
-- profiles: gerente pode atualizar o profile de um técnico (nome, telefone,
-- equipe_id, ativo) — nunca o de outro gerente/gestão, e nunca mudar o
-- próprio `role` de um técnico pra outra coisa (o `with check` obriga a
-- linha continuar com role = 'tecnico' depois do update).
-- -----------------------------------------------------------------------------
create policy "profiles_update_tecnico_by_gerente" on profiles for update
  to authenticated
  using (fn_current_role() = 'gerente' and role = 'tecnico')
  with check (fn_current_role() = 'gerente' and role = 'tecnico');
