-- =============================================================================
-- Fase 3 — Execução (auditoria de segurança, Pacote 1, 21/08/2026)
--
-- Reverte de propósito a decisão da 0017 ("foto vira opcional na conclusão").
-- Motivo: sem foto nenhuma exigida, os sinais de integridade do pacote
-- (geolocalização, carimbo, comparação de distância) não têm efeito prático
-- — o técnico simplesmente não anexa nada. A partir desta migration:
--   - foto "antes" passa a ser obrigatória pra iniciar o atendimento
--     (fn_iniciar_servico não fazia nenhuma exigência até aqui);
--   - foto "depois" volta a ser obrigatória pra concluir (junto com a OS,
--     que já era obrigatória desde a 0014/0017).
--
-- Em vez de criar 'foto_antes'/'foto_depois' no enum `tipo_evidencia`
-- (exigiria ALTER TYPE ... ADD VALUE em transação separada de qualquer uso
-- do valor novo, complicando o rollback desta migration), o momento da foto
-- vira uma coluna nova (`momento`), com `tipo = 'foto'` continuando igual.
--
-- `latitude`/`longitude` — capturadas no momento da foto (Geolocation API do
-- navegador, client-side) — ficam nullable de propósito: GPS indoor falha
-- com frequência nas RTs, e bloquear o técnico por causa disso derrubaria a
-- adoção do pacote inteiro. Ausência de coordenada vira um selo neutro
-- ("sem localização") na tela do gerente, nunca um bloqueio.
--
-- Achado de arquitetura ao planejar isto: as policies de INSERT em
-- `evidencias` e no bucket `evidencias` (0014) só liberavam upload com
-- `servicos.status = 'em_execucao'`. A foto "antes" precisa subir ENQUANTO
-- o serviço ainda está `planejado` (é ela que libera a transição pra
-- em_execucao) — as duas policies abaixo são recriadas pra aceitar os dois
-- status. Continuam bloqueando qualquer upload depois de concluído/validado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Colunas novas em `evidencias`
-- -----------------------------------------------------------------------------
alter table evidencias
  add column momento   text check (momento in ('antes', 'depois')),
  add column latitude   numeric(9,6),
  add column longitude  numeric(9,6);

-- -----------------------------------------------------------------------------
-- 2) RLS — evidencias: aceitar upload também com o serviço ainda `planejado`
-- -----------------------------------------------------------------------------
drop policy "evidencias_insert_tecnico_own" on evidencias;

create policy "evidencias_insert_tecnico_own" on evidencias for insert
  to authenticated with check (
    criado_por = auth.uid()
    and exists (
      select 1 from servicos s
      where s.id = evidencias.servico_id
        and s.tecnico_id = auth.uid()
        and s.status in ('planejado', 'em_execucao')
    )
  );

-- -----------------------------------------------------------------------------
-- 3) RLS — storage.objects (bucket evidencias): mesmo ajuste
-- -----------------------------------------------------------------------------
drop policy "evidencias_storage_insert_tecnico" on storage.objects;

create policy "evidencias_storage_insert_tecnico" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'evidencias'
    and exists (
      select 1 from servicos s
      where s.id::text = (storage.foldername(name))[1]
        and s.tecnico_id = auth.uid()
        and s.status in ('planejado', 'em_execucao')
    )
  );

-- -----------------------------------------------------------------------------
-- 4) fn_iniciar_servico — passa a exigir foto "antes" antes de liberar a
--    transição planejado -> em_execucao.
-- -----------------------------------------------------------------------------
create or replace function fn_iniciar_servico(p_servico_id uuid)
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
    raise exception 'Esse serviço já foi iniciado.';
  end if;

  if not exists (
    select 1 from evidencias
    where servico_id = p_servico_id and tipo = 'foto' and momento = 'antes'
  ) then
    raise exception 'Anexe a foto de antes do atendimento antes de iniciar.';
  end if;

  update servicos set status = 'em_execucao', iniciado_em = now() where id = p_servico_id;

  insert into execucoes (servico_id, iniciado_em) values (p_servico_id, now());

  insert into historico (chamado_id, evento, descricao, criado_por)
  values (v_chamado_id, 'servico_iniciado', 'Técnico iniciou o atendimento em campo.', auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) fn_concluir_servico — foto "depois" volta a ser obrigatória (reverte a
--    0017), além da OS que já era exigida.
-- -----------------------------------------------------------------------------
create or replace function fn_concluir_servico(p_servico_id uuid, p_observacao text)
returns void
language plpgsql
as $$
declare
  v_tecnico_id      uuid;
  v_status          status_servico;
  v_chamado_id      uuid;
  v_rota_id         uuid;
  v_equipe_id       uuid;
  v_tem_os          boolean;
  v_tem_foto_depois boolean;
begin
  select s.tecnico_id, s.status, s.chamado_id, s.rota_id
  into v_tecnico_id, v_status, v_chamado_id, v_rota_id
  from servicos s where s.id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if v_tecnico_id is distinct from auth.uid() then
    raise exception 'Esse serviço não é seu.';
  end if;
  if v_status <> 'em_execucao' then
    raise exception 'Esse serviço precisa estar em execução para ser concluído.';
  end if;
  if p_observacao is null or btrim(p_observacao) = '' then
    raise exception 'Observação é obrigatória para concluir o serviço.';
  end if;

  select exists (select 1 from evidencias where servico_id = p_servico_id and tipo = 'os') into v_tem_os;
  if not v_tem_os then
    raise exception 'Anexe a OS antes de concluir o serviço.';
  end if;

  select exists (
    select 1 from evidencias where servico_id = p_servico_id and tipo = 'foto' and momento = 'depois'
  ) into v_tem_foto_depois;
  if not v_tem_foto_depois then
    raise exception 'Anexe a foto de depois do atendimento antes de concluir.';
  end if;

  select equipe_id into v_equipe_id from rotas where id = v_rota_id;

  update servicos set status = 'concluido_tecnico', concluido_em = now() where id = p_servico_id;

  update execucoes set concluido_em = now(), observacao = p_observacao
    where servico_id = p_servico_id and concluido_em is null;

  insert into conclusoes (servico_id, chamado_id, equipe_id, tecnico_id, observacao)
  values (p_servico_id, v_chamado_id, v_equipe_id, auth.uid(), p_observacao);

  insert into historico (chamado_id, evento, descricao, criado_por)
  values (v_chamado_id, 'servico_concluido_tecnico', 'Técnico concluiu o atendimento — aguardando validação do gerente.', auth.uid());
end;
$$;
