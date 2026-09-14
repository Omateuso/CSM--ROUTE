-- =============================================================================
-- Chamado "para revisão" — fluxo leve de revisão, sem passar pela execução
-- completa (pedido do usuário, 14/09/2026)
--
-- Desde a 0046, um serviço nasce `concluir_hoje` ou `revisao_tecnica`. Até
-- aqui, os dois seguiam o MESMO pipeline (iniciar com foto "antes" →
-- concluir com foto "depois" + OS). O usuário pediu um segundo caminho, só
-- pra quem é `revisao_tecnica`: o técnico tira 1 foto do local + escreve o
-- que encontrou e o que falta pra concluir, e marca "chamado revisado" —
-- sem precisar da foto "antes"/"depois" nem da OS. O serviço sai da lista
-- dele do mesmo jeito que uma conclusão normal.
--
-- Continua valendo o botão "Atender chamado" de sempre — o técnico pode
-- optar pelo atendimento completo (iniciar → concluir, padrão de sempre)
-- em qualquer serviço `revisao_tecnica`, a categoria não bloqueia nada,
-- só oferece o atalho.
--
-- Decisão de design: reaproveita o MESMO destino (`concluido_tecnico`) que
-- `fn_concluir_servico` usa, em vez de um status novo — assim a fila de
-- "Aguardando validação" do gerente já pega os dois sem duplicar tela
-- nenhuma; quem distingue é a coluna `categoria`, que já existe (0046).
-- "Concluído pelo técnico ≠ finalizado administrativamente" continua valendo
-- igual: o gerente ainda precisa validar (ou pedir correção) pra fechar o
-- ciclo, review incluída.
--
-- `fn_revisar_servico` é `security invoker` (mesmo padrão de
-- `fn_avaliar_servico`/`fn_reportar_pendencia`) — as policies que ela
-- precisa já existem: `evidencias_insert_tecnico_own` (0023) aceita upload
-- com o serviço `planejado`; `historico_insert_tecnico_own` (0014) e
-- `conclusoes_insert_own` (0001) já deixam o técnico gravar pro próprio
-- serviço. Nenhuma policy nova.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) `evidencias.momento` ganha 'revisao' — a foto do local na revisão leve.
--    Mesmo padrão da 0025/0037, que já estenderam essa mesma constraint.
-- -----------------------------------------------------------------------------
alter table evidencias drop constraint evidencias_momento_check;
alter table evidencias add constraint evidencias_momento_check
  check (momento in ('antes', 'depois', 'parcial', 'avaliacao', 'revisao'));

-- -----------------------------------------------------------------------------
-- 2) fn_revisar_servico — fecha um serviço `revisao_tecnica` sem passar por
--    `em_execucao`. Exige a foto (momento='revisao') + descrição; grava em
--    `conclusoes` (mesma tabela de sempre, reaproveitada) e um evento
--    próprio `servico_revisado` no histórico (não `servico_concluido_tecnico`,
--    pra dar pra distinguir os dois numa consulta futura sem depender só da
--    categoria do serviço).
-- -----------------------------------------------------------------------------
create or replace function fn_revisar_servico(p_servico_id uuid, p_descricao text)
returns void
language plpgsql
as $$
declare
  v_tecnico_id uuid;
  v_status     status_servico;
  v_categoria  text;
  v_chamado_id uuid;
  v_rota_id    uuid;
  v_equipe_id  uuid;
begin
  select s.tecnico_id, s.status, s.categoria, s.chamado_id, s.rota_id
    into v_tecnico_id, v_status, v_categoria, v_chamado_id, v_rota_id
  from servicos s where s.id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_tecnico_id is distinct from auth.uid() then
    raise exception 'Esse serviço não é seu.';
  end if;
  if v_categoria is distinct from 'revisao_tecnica' then
    raise exception 'Esse chamado não está marcado como revisão técnica.';
  end if;
  if v_status <> 'planejado' then
    raise exception 'Esse serviço já foi iniciado ou concluído.';
  end if;
  if p_descricao is null or btrim(p_descricao) = '' then
    raise exception 'Descreva a situação encontrada e o que falta pra concluir.';
  end if;

  if not exists (
    select 1 from evidencias
    where servico_id = p_servico_id and tipo = 'foto' and momento = 'revisao'
  ) then
    raise exception 'Tire uma foto do local antes de enviar a revisão.';
  end if;

  select equipe_id into v_equipe_id from rotas where id = v_rota_id;

  update servicos set status = 'concluido_tecnico', concluido_em = now() where id = p_servico_id;

  insert into conclusoes (servico_id, chamado_id, equipe_id, tecnico_id, observacao)
  values (p_servico_id, v_chamado_id, v_equipe_id, auth.uid(), p_descricao);

  insert into historico (chamado_id, servico_id, evento, descricao, criado_por)
  values (
    v_chamado_id, p_servico_id, 'servico_revisado',
    'Técnico revisou o chamado — aguardando validação do gerente.', auth.uid()
  );
end;
$$;
