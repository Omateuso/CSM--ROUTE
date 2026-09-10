-- =============================================================================
-- Remoção do rastreamento de posição do técnico — 10/09/2026
--
-- Pedido do usuário: gerente e gestão deixam de ver onde o técnico está. No
-- lugar, a tela "Rota do dia" mostra o STATUS da parada ("Atendimento em
-- andamento"), que já era derivado de `servicos.status` — não precisa de GPS.
--
-- Por que a coleta sai junto, e não só a exibição: guardar localização de
-- trabalhador que ninguém consulta é custo e exposição sem finalidade, e o
-- CLAUDE.md é explícito que este sistema não é ferramenta de controle do
-- prestador. Decisão confirmada com o usuário antes de rodar.
--
-- O que isso desfaz: a tabela e a função da migration 0038 (Fase 5). O que
-- NÃO é afetado: a geolocalização carimbada na foto de evidência (0023) —
-- é outra coisa, serve pra integridade da evidência de um atendimento
-- específico, não pra acompanhar o deslocamento de ninguém.
--
-- `drop table` já remove as policies e tira a tabela da publicação do
-- Realtime automaticamente — não precisa de `alter publication` antes.
-- =============================================================================

drop function if exists fn_expurgar_posicoes(integer);

drop table if exists tecnico_posicao;
