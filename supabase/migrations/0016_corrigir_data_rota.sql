-- =============================================================================
-- Fase 3 — Execução (ajuste pedido pelo usuário, 18/08/2026)
--
-- "Rota confirmada é histórico imutável" continua valendo (Parte C da Fase
-- 2, docs/plano-de-fases.md) — RTs, técnicos e ordem de uma rota confirmada
-- seguem sem UPDATE/DELETE nenhum. A única abertura, pedida explicitamente
-- pelo usuário depois de confirmar uma rota com a data errada (19/08 em vez
-- de 18/08) sem ter como corrigir: permitir trocar só a DATA, e só enquanto
-- nenhum técnico começou a atender nenhum serviço daquela rota.
--
-- Decisão de escopo confirmada com o usuário: correção estreita (só data,
-- só rota sem serviço iniciado) em vez de edição completa da rota — editar
-- RTs/técnicos depois da rota confirmada poderia descolar do que já foi
-- gerado em `servicos` (ex.: remover uma RT que o técnico já começou a
-- atender), então não abrimos essa porta.
--
-- `security definer` de propósito (primeira função do projeto a usar isso):
-- não existe (nem deve existir) uma policy de UPDATE genérica em `rotas` —
-- se existisse, um gerente poderia trocar QUALQUER coluna via chamada
-- direta à API, driblando a regra de "só data, só sem serviço iniciado".
-- Todo o controle de acesso fica dentro desta função (checa o role,
-- `set search_path` fixo por segurança padrão de função security definer).
-- =============================================================================

create or replace function fn_corrigir_data_rota(p_rota_id uuid, p_nova_data date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tem_servico_iniciado boolean;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode corrigir a data de uma rota.';
  end if;

  select exists (
    select 1 from servicos where rota_id = p_rota_id and status <> 'planejado'
  ) into v_tem_servico_iniciado;

  if v_tem_servico_iniciado then
    raise exception 'Essa rota já tem serviço iniciado por um técnico — a data não pode mais ser corrigida.';
  end if;

  update rotas set data = p_nova_data where id = p_rota_id;

  if not found then
    raise exception 'Rota não encontrada.';
  end if;
end;
$$;
