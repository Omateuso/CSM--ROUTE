-- =============================================================================
-- Fase 3 — Execução
-- Fecha as lacunas que a Fase 2 deixou de propósito (item 19 do spec da
-- Parte B: "não antecipar Fase 3"): confirmar rota só gravava `rotas` +
-- `rota_rts`, sem nenhum registro em `servicos` (que exige `chamado_id`
-- obrigatório) e sem nenhuma policy de escrita em `execucoes`/`evidencias`
-- para o técnico gravar a execução em campo.
--
-- Decisões de produto confirmadas com o usuário em 17/08/2026:
--   1. Técnico é atribuído por PARADA (RT) da rota, não por chamado — todos
--      os chamados daquela RT na rota vão para o mesmo técnico. A equipe da
--      rota pode ter vários técnicos; quem escolhe qual técnico fica com
--      qual RT é o gerente, ao confirmar.
--   2. `servicos` são criados automaticamente dentro de `fn_confirmar_rota`
--      (mesma transação) — um serviço por chamado 'aberto' de cada RT da
--      rota. O chamado usado vira 'em_andamento' (evita ser puxado de novo
--      numa 2ª rota confirmada no mesmo dia).
--   3. Fluxo de 1 passo só: "Iniciar" leva direto planejado → em_execucao.
--      O status 'em_deslocamento' do enum fica sem uso por ora (não
--      removido do tipo, só não é atingido por nenhuma função desta fase).
--   4. Concluir exige observação + pelo menos 1 evidência tipo 'foto' + 1
--      evidência tipo 'os' — validado no SERVIDOR (fn_concluir_servico),
--      não só na UI, porque "esconder o botão é UX, RLS/função é quem
--      impede de fato" (convenção do CLAUDE.md).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) fn_confirmar_rota — nova assinatura: recebe um técnico por RT
--    (p_tecnico_ids[i] é o responsável por p_rt_ids[i]). Precisa dropar a
--    versão anterior porque a assinatura muda (mesmo padrão da 0007 pra
--    fn_criar_rt_com_endereco).
-- -----------------------------------------------------------------------------
drop function if exists fn_confirmar_rota(date, uuid, uuid[]);

create or replace function fn_confirmar_rota(
  p_data        date,
  p_equipe_id   uuid,
  p_rt_ids      uuid[],
  p_tecnico_ids uuid[]
) returns uuid
language plpgsql
as $$
declare
  v_rota_id    uuid;
  v_regiao_id  uuid;
  v_rt_id      uuid;
  v_tecnico_id uuid;
  v_tecnico_ok boolean;
  v_chamado_id uuid;
  v_ordem      integer := 1;
begin
  if p_rt_ids is null or array_length(p_rt_ids, 1) is null or array_length(p_rt_ids, 1) = 0 then
    raise exception 'Informe pelo menos uma RT.';
  end if;

  if p_tecnico_ids is null or array_length(p_tecnico_ids, 1) is distinct from array_length(p_rt_ids, 1) then
    raise exception 'Informe um técnico responsável para cada RT da rota.';
  end if;

  select regiao_id into v_regiao_id from rts where id = p_rt_ids[1];
  if v_regiao_id is null then
    raise exception 'RT inválida: %', p_rt_ids[1];
  end if;

  insert into rotas (data, regiao_id, equipe_id, responsavel_id, status, confirmada_em)
  values (p_data, v_regiao_id, p_equipe_id, auth.uid(), 'confirmada', now())
  returning id into v_rota_id;

  for i in 1..array_length(p_rt_ids, 1) loop
    v_rt_id := p_rt_ids[i];
    v_tecnico_id := p_tecnico_ids[i];

    if v_tecnico_id is null then
      raise exception 'Selecione um técnico para todas as RTs da rota.';
    end if;

    select exists (
      select 1 from profiles
      where id = v_tecnico_id and role = 'tecnico' and ativo = true and equipe_id = p_equipe_id
    ) into v_tecnico_ok;

    if not v_tecnico_ok then
      raise exception 'Técnico inválido para a RT %: precisa ser um técnico ativo da equipe selecionada.', v_rt_id;
    end if;

    insert into rota_rts (rota_id, rt_id, ordem) values (v_rota_id, v_rt_id, v_ordem);
    v_ordem := v_ordem + 1;

    -- um serviço por chamado aberto da RT; o chamado passa a 'em_andamento'
    -- pra não ser reincluído numa 2ª rota confirmada no mesmo dia.
    for v_chamado_id in select id from chamados where rt_id = v_rt_id and status = 'aberto' loop
      insert into servicos (rota_id, chamado_id, rt_id, tecnico_id, status)
      values (v_rota_id, v_chamado_id, v_rt_id, v_tecnico_id, 'planejado');

      update chamados set status = 'em_andamento', atualizado_em = now() where id = v_chamado_id;

      insert into historico (chamado_id, evento, descricao, criado_por)
      values (v_chamado_id, 'servico_planejado', 'Incluído na rota confirmada — técnico responsável definido.', auth.uid());
    end loop;
  end loop;

  return v_rota_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) fn_iniciar_servico — único jeito suportado de iniciar um serviço.
--    planejado → em_execucao direto (decisão de produto: fluxo de 1 passo
--    só, sem tela própria de "iniciar deslocamento").
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

  update servicos set status = 'em_execucao', iniciado_em = now() where id = p_servico_id;

  insert into execucoes (servico_id, iniciado_em) values (p_servico_id, now());

  insert into historico (chamado_id, evento, descricao, criado_por)
  values (v_chamado_id, 'servico_iniciado', 'Técnico iniciou o atendimento em campo.', auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) fn_concluir_servico — único jeito suportado de concluir um serviço.
--    Observação + pelo menos 1 evidência 'foto' + 1 evidência 'os' são
--    exigidas aqui (servidor), não só desabilitando o botão na UI —
--    évidências são inseridas via upload pro Storage antes desta chamada.
-- -----------------------------------------------------------------------------
create or replace function fn_concluir_servico(p_servico_id uuid, p_observacao text)
returns void
language plpgsql
as $$
declare
  v_tecnico_id uuid;
  v_status     status_servico;
  v_chamado_id uuid;
  v_rota_id    uuid;
  v_equipe_id  uuid;
  v_tem_foto   boolean;
  v_tem_os     boolean;
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

  select exists (select 1 from evidencias where servico_id = p_servico_id and tipo = 'foto') into v_tem_foto;
  select exists (select 1 from evidencias where servico_id = p_servico_id and tipo = 'os')   into v_tem_os;

  if not v_tem_foto then
    raise exception 'Anexe ao menos uma foto antes de concluir o serviço.';
  end if;
  if not v_tem_os then
    raise exception 'Anexe a OS antes de concluir o serviço.';
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

-- -----------------------------------------------------------------------------
-- 4) RLS — lacunas que a 0001 deixou em aberto de propósito ("refinar por
--    tela conforme a Fase 3/4 avançarem"). As três funções acima rodam
--    security invoker (padrão) e dependem destas policies pra funcionar.
-- -----------------------------------------------------------------------------
create policy "servicos_insert_gerente" on servicos for insert
  to authenticated with check (fn_current_role() = 'gerente');

create policy "execucoes_insert_tecnico_own" on execucoes for insert
  to authenticated with check (
    exists (select 1 from servicos s where s.id = execucoes.servico_id and s.tecnico_id = auth.uid())
  );

create policy "execucoes_update_tecnico_own" on execucoes for update
  to authenticated
  using (exists (select 1 from servicos s where s.id = execucoes.servico_id and s.tecnico_id = auth.uid()))
  with check (exists (select 1 from servicos s where s.id = execucoes.servico_id and s.tecnico_id = auth.uid()));

create policy "evidencias_insert_tecnico_own" on evidencias for insert
  to authenticated with check (
    criado_por = auth.uid()
    and exists (
      select 1 from servicos s
      where s.id = evidencias.servico_id and s.tecnico_id = auth.uid() and s.status = 'em_execucao'
    )
  );
-- sem update/delete em evidencias: uma vez anexada, a evidência é
-- histórico (mesmo raciocínio de rotas confirmadas/rt_enderecos).

create policy "historico_insert_gerente_gestao" on historico for insert
  to authenticated with check (fn_current_role() in ('gerente','gestao'));

create policy "historico_insert_tecnico_own" on historico for insert
  to authenticated with check (
    exists (select 1 from servicos s where s.chamado_id = historico.chamado_id and s.tecnico_id = auth.uid())
  );

-- índices de apoio: servico_id vira o filtro mais comum das policies
-- acima (roda por linha, em toda leitura/escrita destas tabelas).
create index if not exists idx_execucoes_servico  on execucoes (servico_id);
create index if not exists idx_evidencias_servico  on evidencias (servico_id);
create index if not exists idx_conclusoes_servico  on conclusoes (servico_id);

-- -----------------------------------------------------------------------------
-- 5) Storage — bucket "evidencias" (privado) pra fotos/OS anexadas pelo
--    técnico. Convenção de path: "{servico_id}/{tipo}-{timestamp}-{arquivo}"
--    — o 1º segmento do path é o servico_id, é isso que as policies abaixo
--    usam pra checar propriedade via storage.foldername(name).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias',
  'evidencias',
  false,
  10485760, -- 10 MB — foto de celular/PDF de OS, sem exagero pra quem tá no 4G em campo
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "evidencias_storage_insert_tecnico" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'evidencias'
    and exists (
      select 1 from servicos s
      where s.id::text = (storage.foldername(name))[1]
        and s.tecnico_id = auth.uid()
        and s.status = 'em_execucao'
    )
  );

create policy "evidencias_storage_select" on storage.objects for select
  to authenticated using (
    bucket_id = 'evidencias'
    and (
      fn_current_role() in ('gerente','gestao')
      or exists (
        select 1 from servicos s
        where s.id::text = (storage.foldername(name))[1] and s.tecnico_id = auth.uid()
      )
    )
  );
-- sem update/delete no bucket: mesmo raciocínio da tabela `evidencias`.
