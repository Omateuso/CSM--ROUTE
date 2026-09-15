-- =============================================================================
-- Corrige "Falha ao enviar a foto (new row violates row-level security
-- policy)" no fluxo de revisão — bug real relatado pelo usuário, 15/09/2026.
--
-- CAUSA 1 (introduzida por mim nesta sessão, migration 0053/0054): a policy
-- de INSERT em `evidencias` (0050) e a policy de INSERT no bucket
-- `evidencias` (0023) só liberam upload com `servicos.status in
-- ('planejado', 'em_execucao')`. `fn_revisar_servico` (0054) passou a exigir
-- `status = 'em_revisao'` como precondição — mas o técnico sobe a FOTO
-- ANTES de chamar essa função (mesmo padrão sequencial de toda ação do
-- projeto: sobe evidência, só then chama o RPC), e a essa altura o serviço
-- JÁ está em `em_revisao` (só chega lá depois de `fn_iniciar_revisao`).
-- As duas policies rejeitavam esse status, que nunca tinha sido adicionado
-- às duas — o upload nunca tinha chance de completar.
--
-- CAUSA 2 (achado ao investigar a causa 1, PRÉ-EXISTENTE desde a migration
-- 0050, 14/09/2026 — não é bug desta sessão, mas mora na MESMA policy):
-- a policy do BUCKET (`evidencias_storage_insert_tecnico`, 0023) nunca foi
-- atualizada quando a 0050 trouxe múltiplos técnicos por RT — continua
-- checando `s.tecnico_id = auth.uid()` direto, em vez de
-- `fn_pode_atuar_servico(...)` como a policy da TABELA `evidencias` já usa
-- desde a 0050. Um técnico "extra" (vinculado via `rota_rts_tecnicos`, não
-- o principal da parada) conseguiria inserir a LINHA em `evidencias` mas
-- nunca conseguiria subir o ARQUIVO pro bucket — a mesma mensagem de erro,
-- por um motivo diferente. Corrigido junto, já que é a mesma policy.
-- =============================================================================

drop policy "evidencias_insert_tecnico_own" on evidencias;
create policy "evidencias_insert_tecnico_own" on evidencias for insert
  to authenticated with check (
    criado_por = auth.uid()
    and exists (
      select 1 from servicos s
      where s.id = evidencias.servico_id
        and fn_pode_atuar_servico(s.rota_id, s.rt_id, s.tecnico_id)
        and s.status in ('planejado', 'em_execucao', 'em_revisao')
    )
  );

drop policy "evidencias_storage_insert_tecnico" on storage.objects;
create policy "evidencias_storage_insert_tecnico" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'evidencias'
    and exists (
      select 1 from servicos s
      where s.id::text = (storage.foldername(name))[1]
        and fn_pode_atuar_servico(s.rota_id, s.rt_id, s.tecnico_id)
        and s.status in ('planejado', 'em_execucao', 'em_revisao')
    )
  );
