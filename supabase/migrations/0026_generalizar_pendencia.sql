-- =============================================================================
-- Fase 4 — Gestão (generalização, 22/08/2026)
--
-- "Pendência de material" (migration 0025) generalizada pra "Pendência" —
-- achado do usuário usando o app de verdade: nem toda pendência é falta de
-- material. Às vezes precisa de uma decisão da gestão com o proprietário/
-- imobiliária, um equipamento é retirado pra análise, ou um material
-- precisa ser fabricado (não comprado). `historico` ganha `categoria`
-- (nullable — só faz sentido no evento `servico_pendente`, as outras
-- categorias de evento continuam sem essa coluna preenchida) com 5 valores
-- fixos + descrição livre continua sempre obrigatória do técnico pra
-- detalhar o caso específico.
--
-- Evento renomeado de `servico_pendente_material` pra `servico_pendente`
-- (os dois registros fictícios de teste da sessão anterior ficam com o
-- nome antigo — não migrados retroativamente, é só dado de teste).
--
-- Segunda mudança, mesmo achado: o técnico preenche a OS mesmo quando o
-- serviço não é concluído (é como ele documenta o atendimento pro
-- TomTicket de qualquer forma) — `fn_reportar_pendencia_material` só
-- exigia a foto do parcial; a nova versão exige os dois.
-- =============================================================================

alter table historico add column categoria text
  check (categoria in ('falta_material', 'aguardando_gestao', 'equipamento_analise', 'material_fabricacao', 'outro'));

-- `servico_id` (nullable, só preenchido por fn_reportar_pendencia) — a
-- tela de validação precisa mostrar as fotos (parcial + OS) de cada
-- pendência, e `evidencias` é keyed por `servico_id`, não por
-- `chamado_id`. Sem essa coluna não dava pra achar com certeza QUAL
-- serviço cancelado gerou aquele evento específico (um chamado pode ter
-- mais de um serviço cancelado ao longo do tempo).
alter table historico add column servico_id uuid references servicos(id) on delete set null;

drop function fn_reportar_pendencia_material(uuid, text);

create or replace function fn_reportar_pendencia(p_servico_id uuid, p_categoria text, p_descricao text)
returns void
language plpgsql
as $$
declare
  v_tecnico_id uuid;
  v_status     status_servico;
  v_chamado_id uuid;
  v_tem_foto   boolean;
  v_tem_os     boolean;
begin
  select tecnico_id, status, chamado_id into v_tecnico_id, v_status, v_chamado_id
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_tecnico_id is distinct from auth.uid() then
    raise exception 'Esse serviço não é seu.';
  end if;
  if v_status <> 'em_execucao' then
    raise exception 'Só é possível reportar pendência num atendimento em execução.';
  end if;
  if p_categoria is null or p_categoria not in
    ('falta_material', 'aguardando_gestao', 'equipamento_analise', 'material_fabricacao', 'outro')
  then
    raise exception 'Selecione o tipo de pendência.';
  end if;
  if p_descricao is null or btrim(p_descricao) = '' then
    raise exception 'Descreva o que já foi feito e o motivo da pendência.';
  end if;

  select exists (
    select 1 from evidencias where servico_id = p_servico_id and tipo = 'foto' and momento = 'parcial'
  ) into v_tem_foto;
  if not v_tem_foto then
    raise exception 'Anexe uma foto do que já foi feito antes de reportar a pendência.';
  end if;

  select exists (select 1 from evidencias where servico_id = p_servico_id and tipo = 'os') into v_tem_os;
  if not v_tem_os then
    raise exception 'Anexe a OS antes de reportar a pendência.';
  end if;

  update servicos set status = 'cancelado' where id = p_servico_id;

  insert into historico (chamado_id, servico_id, evento, categoria, descricao, criado_por)
  values (v_chamado_id, p_servico_id, 'servico_pendente', p_categoria, p_descricao, auth.uid());
end;
$$;
