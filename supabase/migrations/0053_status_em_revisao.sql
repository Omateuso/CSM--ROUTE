-- =============================================================================
-- Novo status `em_revisao` (pedido do usuário, 15/09/2026) — "quando colocar
-- começar a revisar um chamado ele deve ser classificado como 'em revisão'
-- ao invés de 'em execução', pois a conclusão deles é diferente".
--
-- Hoje o fluxo leve de revisão (`categoria='revisao_tecnica'`, migration 0047)
-- não tem NENHUMA etapa "em andamento" — `fn_revisar_servico` salta direto
-- de `planejado` pra `concluido_tecnico` num passo só. Este status é o que
-- vai marcar "o técnico começou a revisar, mas ainda não terminou" — a
-- contraparte de `em_execucao` (que continua exclusivo do atendimento
-- completo). As duas funções que efetivamente usam esse valor
-- (`fn_iniciar_revisao`/`fn_revisar_servico`) vão pra migration SEGUINTE
-- (0054) de propósito: Postgres não deixa usar um valor de enum recém-criado
-- na MESMA transação em que ele foi adicionado (mesma regra já documentada
-- na 0051 pro `tipo_evidencia`) — aqui ISSO REALMENTE SE APLICA, porque
-- `status_servico` é um enum de verdade (0001), diferente de `evidencias.momento`
-- (que é TEXT+CHECK, sem essa restrição).
-- =============================================================================

alter type status_servico add value 'em_revisao';
