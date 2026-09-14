-- =============================================================================
-- Realtime pra mais telas — sem F5 pro técnico/gerente/gestão (pedido do
-- usuário, 14/09/2026)
--
-- Só `servicos` (0019) e `chamado_respostas` (0036) estavam na publicação
-- `supabase_realtime` até aqui — cobre o Dashboard do gerente e o
-- sino/toast de resposta do cliente, mas não os eventos que só mexem em
-- `historico` sem tocar `servicos` (um apontamento do técnico, por
-- exemplo — `fn_avaliar_servico` só grava histórico, não muda status),
-- nem `chamados`/`rotas` puros (chamado novo trazido pela sincronização,
-- rota confirmada).
--
-- Mesmo padrão da 0019/0036: só `alter publication ... add table`, sem
-- `replica identity full` — nenhuma dessas tabelas é atualizada/apagada
-- por um caminho que precise do valor ANTIGO da linha (todo INSERT é
-- suficiente pra disparar `router.refresh()`, que refaz a consulta inteira
-- no servidor; o "contrato pobre" de lib/realtime/ nunca lê o payload do
-- evento, só usa a mudança como gatilho).
-- =============================================================================

alter publication supabase_realtime add table historico;
alter publication supabase_realtime add table chamados;
alter publication supabase_realtime add table rotas;
