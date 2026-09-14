-- =============================================================================
-- Mais de um técnico por parada da rota (pedido do usuário, 14/09/2026)
--
-- Até aqui, cada RT de uma rota tinha exatamente UM técnico responsável
-- (rota_rts.tecnico_id, parâmetro paralelo p_tecnico_ids de fn_confirmar_rota)
-- e cada `servico` nascia com esse único `tecnico_id`. O pedido: uma visita
-- pode precisar de mais de uma pessoa (ex.: serviço grande, treinamento de
-- um técnico novo) — o gerente vincula um segundo (ou mais) atendente à
-- mesma RT, e os chamados daquela RT aparecem pra TODOS eles, não só pro
-- "principal".
--
-- Decisão de design (aditiva, não substitui nada que já existe):
--   - `rota_rts.tecnico_id` continua existindo exatamente como antes — é o
--     "principal" da parada, e é quem `servicos.tecnico_id` grava (nenhuma
--     tela que já lê essas colunas precisa mudar: Rotas confirmadas, Painel
--     da gestão, relatórios, Central de Urgências).
--   - Nova tabela `rota_rts_tecnicos` é o conjunto COMPLETO de quem pode ver
--     e atuar numa parada — sempre inclui o principal + qualquer extra que o
--     gerente vincular. Não reescreve a atribuição individual de cada
--     `servico`; só AMPLIA quem enxerga e pode agir sobre ele.
--   - `servicos.tecnico_id` nunca é reatribuído quando um co-técnico age
--     (inicia/conclui/etc.) — continua marcando o principal. Trade-off
--     assumido: "Concluído por X" na Validação pode não refletir quem de
--     fato apertou o botão, se foi um dos extras. Não foi pedido rastreio
--     de autoria por ação, só visibilidade — manter simples.
--   - `fn_pode_atuar_servico` é o ÚNICO lugar que decide "esse usuário pode
--     ver/agir nesse serviço" — usado tanto nas policies de RLS quanto
--     dentro das próprias funções de ação (iniciar/concluir/revisar/
--     pendência/avaliar), pra não duplicar a mesma regra em 6+ lugares com
--     risco de um ficar desatualizado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabela nova
-- -----------------------------------------------------------------------------
create table rota_rts_tecnicos (
  id          uuid primary key default gen_random_uuid(),
  rota_id     uuid not null,
  rt_id       uuid not null,
  tecnico_id  uuid not null references profiles(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  unique (rota_id, rt_id, tecnico_id),
  foreign key (rota_id, rt_id) references rota_rts (rota_id, rt_id) on delete cascade
);

create index idx_rota_rts_tecnicos_rota_rt on rota_rts_tecnicos (rota_id, rt_id);
create index idx_rota_rts_tecnicos_tecnico on rota_rts_tecnicos (tecnico_id);

alter table rota_rts_tecnicos enable row level security;

create policy "rota_rts_tecnicos_select" on rota_rts_tecnicos for select
  using (tecnico_id = auth.uid() or fn_current_role() in ('gerente', 'gestao'));

-- Sem policy de UPDATE/DELETE pra `authenticated`, de propósito — mesmo
-- padrão de `rotas`/`rota_rts` (0011): a única forma de mexer no conjunto é
-- pelas funções abaixo (`fn_confirmar_rota`, `security invoker`, por isso
-- ainda precisa da policy de INSERT; `fn_trocar_tecnico_parada`, `security
-- definer`, não precisa de policy nenhuma pra escrever).
create policy "rota_rts_tecnicos_insert_gerente" on rota_rts_tecnicos for insert
  to authenticated with check (fn_current_role() = 'gerente');

-- -----------------------------------------------------------------------------
-- 2) fn_pode_atuar_servico — a regra única de "pode ver/agir nesse serviço".
--    `security definer` pra poder ler `rota_rts_tecnicos` sem depender de o
--    chamador já ter acesso de leitura a linhas de OUTRO técnico ali (a
--    policy de select da tabela nova já cobre isso, mas ficar independente
--    dela é mais robusto a uma mudança futura na policy).
-- -----------------------------------------------------------------------------
create or replace function fn_pode_atuar_servico(p_rota_id uuid, p_rt_id uuid, p_tecnico_id_linha uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_tecnico_id_linha = auth.uid()
    or exists (
      select 1 from rota_rts_tecnicos rrt
      where rrt.rota_id = p_rota_id and rrt.rt_id = p_rt_id and rrt.tecnico_id = auth.uid()
    );
$$;

-- -----------------------------------------------------------------------------
-- 3) RLS ampliada — mesma troca em todo lugar que hoje só olha
--    `tecnico_id = auth.uid()` pra decidir se o técnico pode ver/escrever.
-- -----------------------------------------------------------------------------
drop policy "servicos_select" on servicos;
create policy "servicos_select"
  on servicos for select
  using (fn_pode_atuar_servico(rota_id, rt_id, tecnico_id) or fn_current_role() in ('gerente', 'gestao'));

drop policy "servicos_update_own_or_management" on servicos;
create policy "servicos_update_own_or_management"
  on servicos for update
  using (fn_pode_atuar_servico(rota_id, rt_id, tecnico_id) or fn_current_role() in ('gerente', 'gestao'));

drop policy "evidencias_insert_tecnico_own" on evidencias;
create policy "evidencias_insert_tecnico_own" on evidencias for insert
  to authenticated with check (
    criado_por = auth.uid()
    and exists (
      select 1 from servicos s
      where s.id = evidencias.servico_id
        and fn_pode_atuar_servico(s.rota_id, s.rt_id, s.tecnico_id)
        and s.status in ('planejado', 'em_execucao')
    )
  );

drop policy "historico_insert_tecnico_own" on historico;
create policy "historico_insert_tecnico_own" on historico for insert
  to authenticated with check (
    exists (
      select 1 from servicos s
      where s.chamado_id = historico.chamado_id
        and fn_pode_atuar_servico(s.rota_id, s.rt_id, s.tecnico_id)
    )
  );

drop policy "execucoes_insert_tecnico_own" on execucoes;
create policy "execucoes_insert_tecnico_own" on execucoes for insert
  to authenticated with check (
    exists (
      select 1 from servicos s
      where s.id = execucoes.servico_id and fn_pode_atuar_servico(s.rota_id, s.rt_id, s.tecnico_id)
    )
  );

drop policy "execucoes_update_tecnico_own" on execucoes;
create policy "execucoes_update_tecnico_own" on execucoes for update
  to authenticated
  using (
    exists (
      select 1 from servicos s
      where s.id = execucoes.servico_id and fn_pode_atuar_servico(s.rota_id, s.rt_id, s.tecnico_id)
    )
  )
  with check (
    exists (
      select 1 from servicos s
      where s.id = execucoes.servico_id and fn_pode_atuar_servico(s.rota_id, s.rt_id, s.tecnico_id)
    )
  );

-- `conclusoes_insert_own` (0001) não precisa mudar: ela só confere que
-- `tecnico_id` da linha nova é o próprio autor (`tecnico_id = auth.uid()`),
-- não que ele é o "dono" do serviço — quem barra isso é o guard dentro de
-- `fn_concluir_servico`/`fn_revisar_servico`, ajustados abaixo.

-- -----------------------------------------------------------------------------
-- 4) fn_confirmar_rota — ganha `p_tecnicos_extra jsonb default null`, um
--    objeto {"<rtId>": ["<tecnicoId>", ...]} com os atendentes ALÉM do
--    principal (que continua em `p_tecnico_ids`, sem mudança). Assinatura
--    muda (novo parâmetro) — drop antes de recriar (mesmo caso da
--    0007/0014/0033/0046).
-- -----------------------------------------------------------------------------
drop function if exists fn_confirmar_rota(date, uuid, uuid[], uuid[], uuid[]);

create or replace function fn_confirmar_rota(
  p_data            date,
  p_equipe_id       uuid,
  p_rt_ids          uuid[],
  p_tecnico_ids     uuid[],
  p_chamados_dia    uuid[] default null,
  p_tecnicos_extra  jsonb default null
) returns uuid
language plpgsql
as $$
declare
  v_rota_id         uuid;
  v_regiao_id       uuid;
  v_rt_id           uuid;
  v_tecnico_id      uuid;
  v_tecnico_ok      boolean;
  v_chamado_id      uuid;
  v_ordem           integer := 1;
  v_categorizado    boolean;
  v_extra_id_texto  text;
  v_extra_id        uuid;
begin
  if p_rt_ids is null or array_length(p_rt_ids, 1) is null or array_length(p_rt_ids, 1) = 0 then
    raise exception 'Informe pelo menos uma RT.';
  end if;

  if p_tecnico_ids is null or array_length(p_tecnico_ids, 1) is distinct from array_length(p_rt_ids, 1) then
    raise exception 'Informe um técnico responsável para cada RT da rota.';
  end if;

  -- NULL = comportamento de sempre (todo chamado elegível nasce
  -- concluir_hoje — é o que qualquer chamada antiga a esta função, sem o
  -- parâmetro novo, continua produzindo). Lista informada — mesmo vazia —
  -- decide a categoria explicitamente: um chamado dentro dela é
  -- concluir_hoje, qualquer outro elegível da rota é revisao_tecnica.
  v_categorizado := p_chamados_dia is not null;

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

    insert into rota_rts (rota_id, rt_id, ordem, tecnico_id) values (v_rota_id, v_rt_id, v_ordem, v_tecnico_id);
    v_ordem := v_ordem + 1;

    -- O principal sempre entra no conjunto de quem pode atuar — é assim que
    -- `fn_pode_atuar_servico` fica com uma fonte única (a tabela nova), sem
    -- precisar "OU verificar rota_rts.tecnico_id também" em todo lugar.
    insert into rota_rts_tecnicos (rota_id, rt_id, tecnico_id) values (v_rota_id, v_rt_id, v_tecnico_id)
      on conflict (rota_id, rt_id, tecnico_id) do nothing;

    -- Extras dessa RT, se houver — mesma validação do principal (ativo,
    -- técnico, da equipe escolhida). `on conflict do nothing` cobre o
    -- gerente mandando o mesmo id duas vezes (ex.: repetiu o principal na
    -- lista de extras por engano) sem quebrar a confirmação inteira.
    if p_tecnicos_extra is not null and p_tecnicos_extra ? v_rt_id::text then
      for v_extra_id_texto in select jsonb_array_elements_text(p_tecnicos_extra -> v_rt_id::text) loop
        v_extra_id := v_extra_id_texto::uuid;

        select exists (
          select 1 from profiles
          where id = v_extra_id and role = 'tecnico' and ativo = true and equipe_id = p_equipe_id
        ) into v_tecnico_ok;

        if not v_tecnico_ok then
          raise exception 'Técnico extra inválido para a RT %: precisa ser um técnico ativo da equipe selecionada.', v_rt_id;
        end if;

        insert into rota_rts_tecnicos (rota_id, rt_id, tecnico_id) values (v_rota_id, v_rt_id, v_extra_id)
          on conflict (rota_id, rt_id, tecnico_id) do nothing;
      end loop;
    end if;

    -- elegível = ainda não fechado no TomTicket (aberto/em_andamento contam
    -- os dois — 0015) E ainda não tem `servico` não-cancelado gerado antes.
    -- Todo elegível ganha serviço, sempre, atribuído ao PRINCIPAL — os
    -- extras enxergam/agem via `rota_rts_tecnicos`, sem duplicar `servico`.
    for v_chamado_id in
      select c.id from chamados c
      where c.rt_id = v_rt_id
        and c.status not in ('finalizado', 'cancelado')
        and not exists (
          select 1 from servicos sv where sv.chamado_id = c.id and sv.status <> 'cancelado'
        )
    loop
      insert into servicos (rota_id, chamado_id, rt_id, tecnico_id, status, categoria)
      values (
        v_rota_id, v_chamado_id, v_rt_id, v_tecnico_id, 'planejado',
        case
          when not v_categorizado then 'concluir_hoje'
          when v_chamado_id = any (p_chamados_dia) then 'concluir_hoje'
          else 'revisao_tecnica'
        end
      );

      insert into historico (chamado_id, evento, descricao, criado_por)
      values (
        v_chamado_id,
        'servico_planejado',
        case
          when v_categorizado and not (v_chamado_id = any (p_chamados_dia))
            then 'Incluído na rota confirmada — para revisão técnica (não é pra concluir hoje).'
          else 'Incluído na rota confirmada — para concluir hoje.'
        end,
        auth.uid()
      );
    end loop;
  end loop;

  return v_rota_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) fn_trocar_tecnico_parada (0031) — trocar o principal agora RESETA o
--    conjunto de `rota_rts_tecnicos` pra só o novo técnico. Simplificação
--    deliberada: "trocar o responsável" volta a parada a ter um único
--    atendente — se o gerente quer voltar a ter mais de um depois, é uma
--    nova confirmação de rota (esta função continua travada, como sempre
--    esteve, se algum serviço da parada já saiu de `planejado`).
-- -----------------------------------------------------------------------------
create or replace function fn_trocar_tecnico_parada(p_rota_id uuid, p_rt_id uuid, p_tecnico_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role         user_role;
  v_tem_iniciado boolean;
  v_chamado_id   uuid;
begin
  if fn_current_role() is distinct from 'gerente' then
    raise exception 'Só o gerente pode trocar o técnico de uma parada.';
  end if;

  select role into v_role from profiles where id = p_tecnico_id;
  if v_role is distinct from 'tecnico' then
    raise exception 'O responsável por uma parada precisa ser um técnico.';
  end if;

  select exists (
    select 1 from servicos
    where rota_id = p_rota_id and rt_id = p_rt_id and status <> 'planejado'
  ) into v_tem_iniciado;

  if v_tem_iniciado then
    raise exception 'Essa parada já foi iniciada pelo técnico — não dá mais pra trocar o responsável.';
  end if;

  update rota_rts set tecnico_id = p_tecnico_id where rota_id = p_rota_id and rt_id = p_rt_id;
  if not found then
    raise exception 'Parada não encontrada nessa rota.';
  end if;

  update servicos set tecnico_id = p_tecnico_id
   where rota_id = p_rota_id and rt_id = p_rt_id and status = 'planejado';

  delete from rota_rts_tecnicos where rota_id = p_rota_id and rt_id = p_rt_id;
  insert into rota_rts_tecnicos (rota_id, rt_id, tecnico_id) values (p_rota_id, p_rt_id, p_tecnico_id);

  for v_chamado_id in
    select distinct chamado_id from servicos where rota_id = p_rota_id and rt_id = p_rt_id
  loop
    insert into historico (chamado_id, evento, descricao, criado_por)
    values (
      v_chamado_id,
      'tecnico_trocado',
      format('Responsável pela parada trocado para %s.',
             coalesce((select nome from profiles where id = p_tecnico_id), 'outro técnico')),
      auth.uid()
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6) Guard ampliado nas 5 funções de ação do técnico — troca
--    `tecnico_id = auth.uid()` (comparação direta) por
--    `fn_pode_atuar_servico(rota_id, rt_id, tecnico_id)`. Assinatura de
--    nenhuma delas muda — `create or replace` direto.
-- -----------------------------------------------------------------------------
create or replace function fn_iniciar_servico(p_servico_id uuid)
returns void
language plpgsql
as $$
declare
  v_tecnico_id uuid;
  v_status     status_servico;
  v_chamado_id uuid;
  v_rota_id    uuid;
  v_rt_id      uuid;
begin
  select tecnico_id, status, chamado_id, rota_id, rt_id
    into v_tecnico_id, v_status, v_chamado_id, v_rota_id, v_rt_id
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if not fn_pode_atuar_servico(v_rota_id, v_rt_id, v_tecnico_id) then
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

create or replace function fn_concluir_servico(p_servico_id uuid, p_observacao text)
returns void
language plpgsql
as $$
declare
  v_tecnico_id      uuid;
  v_status          status_servico;
  v_chamado_id      uuid;
  v_rota_id         uuid;
  v_rt_id           uuid;
  v_equipe_id       uuid;
  v_tem_os          boolean;
  v_tem_foto_depois boolean;
begin
  select s.tecnico_id, s.status, s.chamado_id, s.rota_id, s.rt_id
  into v_tecnico_id, v_status, v_chamado_id, v_rota_id, v_rt_id
  from servicos s where s.id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if not fn_pode_atuar_servico(v_rota_id, v_rt_id, v_tecnico_id) then
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
  v_rt_id      uuid;
  v_equipe_id  uuid;
begin
  select s.tecnico_id, s.status, s.categoria, s.chamado_id, s.rota_id, s.rt_id
    into v_tecnico_id, v_status, v_categoria, v_chamado_id, v_rota_id, v_rt_id
  from servicos s where s.id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if not fn_pode_atuar_servico(v_rota_id, v_rt_id, v_tecnico_id) then
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

create or replace function fn_reportar_pendencia(p_servico_id uuid, p_categoria text, p_descricao text)
returns void
language plpgsql
as $$
declare
  v_tecnico_id uuid;
  v_status     status_servico;
  v_chamado_id uuid;
  v_rota_id    uuid;
  v_rt_id      uuid;
  v_tem_foto   boolean;
  v_tem_os     boolean;
begin
  select tecnico_id, status, chamado_id, rota_id, rt_id
    into v_tecnico_id, v_status, v_chamado_id, v_rota_id, v_rt_id
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if not fn_pode_atuar_servico(v_rota_id, v_rt_id, v_tecnico_id) then
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

create or replace function fn_avaliar_servico(p_servico_id uuid, p_descricao text)
returns void
language plpgsql
as $$
declare
  v_tecnico_id uuid;
  v_status     status_servico;
  v_chamado_id uuid;
  v_rota_id    uuid;
  v_rt_id      uuid;
begin
  select tecnico_id, status, chamado_id, rota_id, rt_id
    into v_tecnico_id, v_status, v_chamado_id, v_rota_id, v_rt_id
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;
  if not fn_pode_atuar_servico(v_rota_id, v_rt_id, v_tecnico_id) then
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
