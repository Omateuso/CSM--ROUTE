-- =============================================================================
-- Fase 3 — Execução (auditoria de segurança, Pacote 2, 21/08/2026)
--
-- Achado mais sério da lista de 6: nada impede hoje anexar o mesmo arquivo
-- de OS em dois serviços diferentes (mesma foto/PDF reaproveitado pra
-- "documentar" mais de um atendimento). Detecção via hash SHA-256 do
-- arquivo, calculado no server action (Node `crypto`, não `crypto.subtle`
-- no client) porque o arquivo já chega ali via FormData — sem custo extra,
-- sem serviço externo.
--
-- Coluna aplicada a toda evidência (foto e OS), não só OS — mesmo custo de
-- calcular, e serve de base se um dia quiserem detectar foto reaproveitada
-- também. A comparação em si (Pacote 2 da auditoria) só olha `tipo = 'os'`
-- por ora, conforme pedido.
-- =============================================================================

alter table evidencias add column hash_arquivo text;
create index idx_evidencias_hash on evidencias (hash_arquivo);
