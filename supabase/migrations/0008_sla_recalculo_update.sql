-- =============================================================================
-- Fase 1 — Base Operacional (B3, Chamados)
-- O trigger trg_chamados_sla (migration 0001, fn_set_sla_prazo) só disparava
-- em INSERT. A tela de edição manual de chamados (B3) permite ao gerente
-- corrigir a prioridade de um chamado já existente — sem esse ajuste,
-- sla_prazo ficaria parado no valor calculado com a prioridade antiga.
--
-- fn_set_sla_prazo não muda: ela usa new.criado_em (que não muda num
-- UPDATE que não mexe nessa coluna) + sla_regras.prazo_horas da
-- new.prioridade — já funciona corretamente também no caminho de update.
-- =============================================================================

drop trigger trg_chamados_sla on chamados;

create trigger trg_chamados_sla
  before insert or update of prioridade on chamados
  for each row execute function fn_set_sla_prazo();
