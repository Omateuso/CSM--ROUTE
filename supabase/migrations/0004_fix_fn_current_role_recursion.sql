-- =============================================================================
-- Fase 1 — Base Operacional
-- Bug encontrado testando o login de verdade: fn_current_role() faz
-- `select role from profiles where id = auth.uid()`, mas é chamada de
-- dentro da policy "profiles_select_own_or_management" (SELECT em
-- profiles). Como a função roda como SECURITY INVOKER (padrão), a própria
-- consulta interna dela também é filtrada por essa mesma policy — que
-- chama fn_current_role() de novo, e de novo, até estourar a pilha
-- (54001 stack depth limit exceeded). Todo select em profiles falhava,
-- inclusive um usuário lendo o próprio perfil.
--
-- Fix padrão do Postgres/Supabase para esse tipo de "helper function usada
-- em RLS que lê a própria tabela protegida": marcar a função como
-- SECURITY DEFINER, com search_path fixo (evita search_path hijacking).
-- Isso faz a consulta interna rodar com o privilégio do dono da função
-- (bypassa RLS nessa única consulta interna e específica), quebrando a
-- recursão. A função continua só devolvendo a role do próprio
-- auth.uid() — não expõe dado de outro usuário.
-- =============================================================================
create or replace function fn_current_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid()
$$;
