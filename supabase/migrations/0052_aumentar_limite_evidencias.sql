-- =============================================================================
-- Aumenta o limite de tamanho do bucket `evidencias` (pedido do usuário,
-- 15/09/2026 — "insuficiência de memória na hora de subir as fotos, tente
-- aumentar o limite de tamanho das imagens").
--
-- A causa real do travamento era outra (client-side: camera-capture-field.tsx
-- decodificava a foto em resolução NATIVA da câmera antes de reduzir —
-- corrigido separadamente, sem migration, usando createImageBitmap com
-- resize já na decodificação). Mesmo assim, o teto de 10MB por arquivo
-- (migration 0014) ficava justo pra uma OS em PDF/foto sem compressão
-- (0027/0051 — só a foto de evidência é comprimida no cliente, a OS não) —
-- subir o teto aqui é reforço direto ao pedido do usuário, sem contradizer
-- a correção de memória (o teto do bucket nunca foi a causa do travamento).
-- =============================================================================

update storage.buckets
set file_size_limit = 26214400 -- 25MB (era 10MB desde a 0014)
where id = 'evidencias';
