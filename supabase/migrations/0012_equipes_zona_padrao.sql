-- =============================================================================
-- Fase 2 — Rotas (Parte A, ajuste)
-- `equipes.regiao_padrao_id` apontava pra `regioes` (bairro) — decisão do
-- usuário em 17/08/2026: uma equipe cobre uma zona inteira, não um bairro
-- específico, então o campo passa a apontar pra `zonas`. Dado existente é
-- migrado automaticamente (regiao -> zona da própria regiao) antes da
-- coluna antiga ser removida.
-- =============================================================================

alter table equipes add column zona_padrao_id uuid references zonas(id) on delete set null;

update equipes e
set zona_padrao_id = r.zona_id
from regioes r
where e.regiao_padrao_id = r.id;

alter table equipes drop column regiao_padrao_id;
