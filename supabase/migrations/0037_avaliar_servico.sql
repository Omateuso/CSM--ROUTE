-- =============================================================================
-- Evolução para plataforma operacional — Fase 4 (seção 7), 09/09/2026
--
-- "Avaliação do serviço antes de executar." O técnico, olhando um serviço
-- ainda `planejado` (antes da foto "antes", antes de iniciar), aponta que o
-- SERVIÇO EM SI tem um problema que faz não valer executar como está:
-- chamado já resolvido, RT/endereço errado, escopo diferente do descrito,
-- duplicado, sem acesso ao imóvel, fora de escopo da CSM.
--
-- É diferente da PENDÊNCIA (0025/0026): pendência é DURANTE a execução
-- (`em_execucao`), exige foto parcial + OS, significa "comecei e não consigo
-- terminar". Avaliação é ANTES, leve, "isso não deveria ser feito assim".
--
-- Decisões de produto (confirmadas com o usuário):
--   - link DISCRETO na tela do técnico, NÃO etapa obrigatória antes de todo
--     "Iniciar";
--   - o serviço CONTINUA `planejado` — o apontamento é só um evento no
--     `historico`, o técnico pode iniciar mesmo assim ou seguir pra próxima
--     RT, e o gerente decide (reagendar / cancelar rota / conversar);
--   - só descrição livre, sem catálogo de motivos;
--   - foto obrigatória (carimbada, câmera + geolocalização) — prova de que o
--     técnico esteve no local antes de apontar.
--
-- `fn_avaliar_servico` é `security invoker` (igual `fn_reportar_pendencia`):
-- a policy `historico_insert_tecnico_own` (0014) já deixa o técnico inserir
-- evento pra chamado onde ele tem serviço, e `evidencias_insert_tecnico_own`
-- (0023) já aceita upload com o serviço `planejado`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) `evidencias.momento` ganha 'avaliacao' (a foto do apontamento). Mesmo
--    padrão da 0025, que adicionou 'parcial' — a constraint segue o nome
--    automático do Postgres pra check inline de coluna.
-- -----------------------------------------------------------------------------
alter table evidencias drop constraint evidencias_momento_check;
alter table evidencias add constraint evidencias_momento_check
  check (momento in ('antes', 'depois', 'parcial', 'avaliacao'));

-- -----------------------------------------------------------------------------
-- 2) fn_avaliar_servico — registra o apontamento. NÃO altera `servicos`.
-- -----------------------------------------------------------------------------
create or replace function fn_avaliar_servico(p_servico_id uuid, p_descricao text)
returns void
language plpgsql
as $$
declare
  v_tecnico_id uuid;
  v_status     status_servico;
  v_chamado_id uuid;
begin
  select tecnico_id, status, chamado_id into v_tecnico_id, v_status, v_chamado_id
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_tecnico_id is distinct from auth.uid() then
    raise exception 'Esse serviço não é seu.';
  end if;
  if v_status <> 'planejado' then
    raise exception 'Só dá pra apontar um problema antes de iniciar o atendimento.';
  end if;
  if p_descricao is null or btrim(p_descricao) = '' then
    raise exception 'Descreva o problema que você encontrou.';
  end if;

  if not exists (
    select 1 from evidencias
    where servico_id = p_servico_id and tipo = 'foto' and momento = 'avaliacao'
  ) then
    raise exception 'Tire uma foto do problema antes de enviar.';
  end if;

  -- Um apontamento por serviço — clicar duas vezes não gera dois eventos.
  if exists (
    select 1 from historico
    where servico_id = p_servico_id and evento = 'servico_avaliado'
  ) then
    raise exception 'Você já apontou um problema neste serviço.';
  end if;

  insert into historico (chamado_id, servico_id, evento, descricao, criado_por)
  values (v_chamado_id, p_servico_id, 'servico_avaliado', p_descricao, auth.uid());
end;
$$;
