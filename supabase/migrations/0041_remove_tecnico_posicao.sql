-- =============================================================================
-- Remove a "Rota do dia ao vivo" (Fase 5, 0038) — decisão do usuário, 10/09/2026
--
-- Motivo: rastrear a posição do técnico em tempo real vira ruído e lê como
-- fiscalização — o técnico para pra almoçar, sai de uma RT pra comprar
-- material e volta. Contra o princípio do CLAUDE.md ("não é ferramenta de
-- controle/punição do prestador de serviço"). O ETA/rota por carro passou a
-- ser resolvido por OSRM (Mateus), então o mapa da tela também mudou de base.
--
-- Some: a tabela `tecnico_posicao`, suas policies, a publicação Realtime dela
-- e a função de expurgo. Dropar a tabela já a remove de qualquer publicação
-- e leva as policies junto — não precisa de `alter publication` explícito.
--
-- Código removido no mesmo commit: app/rotas/hoje/*, app/(tecnico)/layout.tsx,
-- posicao-reporter.tsx, posicao-actions.ts, o item "Rota do dia" do menu, o
-- ícone `pin`, o expurgo no instrumentation.ts e a limpeza no
-- reset-dados-operacionais.mjs.
-- =============================================================================

drop function if exists fn_expurgar_posicoes(integer);
drop table if exists tecnico_posicao;
