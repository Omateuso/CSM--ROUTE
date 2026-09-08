-- =============================================================================
-- Correção de segurança (08/09/2026) — guard de role falhava ABERTO
--
-- Achado enquanto eu conferia a 0028 recém-aplicada: chamando a RPC com a
-- chave ANÔNIMA, sem login nenhum, a função executava o corpo em vez de barrar.
--
--     curl -X POST .../rpc/fn_corrigir_data_rota -H "apikey: <ANON>" ...
--     -> {"code":"P0001","message":"Rota não encontrada."}
--
-- "Rota não encontrada" quer dizer que ela PASSOU pela checagem de role.
--
-- Causa: lógica de três valores do SQL. Sem usuário logado, `auth.uid()` é
-- NULL, então `fn_current_role()` devolve NULL — e `NULL <> 'gerente'` não é
-- TRUE, é NULL. O `if` não dispara e o guard é pulado.
--
--     select null <> 'gerente';              -- NULL  (o if NÃO entra)
--     select null is distinct from 'gerente'; -- TRUE  (o if entra, correto)
--
-- Por que só estas duas funções: as duas são `security definer`, ou seja,
-- rodam com o privilégio do dono e IGNORAM RLS — passar do guard significa
-- escrever de verdade. As outras funções do projeto que usam o mesmo `<>`
-- (fn_validar_servico, fn_reagendar_servico, fn_recusar_servico, as da 0027)
-- NÃO são security definer: rodam como o chamador, e a RLS segura. Conferido
-- ao vivo: com a chave anônima, `select` em `servicos` e em `rotas` devolve
-- `[]`, então o corpo delas não acha linha nenhuma pra alterar.
--
-- Mesmo assim vale trocar o `<>` por `is distinct from` naquelas também, um
-- dia — ali é defesa em profundidade, não brecha, e por isso não entram nesta
-- migration (recriar 11 funções que não têm bug ativo é mais risco que ganho).
--
-- As POLICIES de RLS não têm esse problema: usam comparação positiva
-- (`fn_current_role() = 'gerente'`), que com NULL dá NULL e portanto NEGA.
-- Policy falha fechada; o `if ... <> ...` falhava aberto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. fn_corrigir_data_rota — pré-existente (0016, histórico na 0022).
--    Corpo idêntico ao da 0022, só o guard muda.
-- -----------------------------------------------------------------------------
create or replace function fn_corrigir_data_rota(p_rota_id uuid, p_nova_data date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tem_servico_iniciado boolean;
  v_data_antiga date;
  v_chamado_id uuid;
begin
  if fn_current_role() is distinct from 'gerente' then
    raise exception 'Só o gerente pode corrigir a data de uma rota.';
  end if;

  select exists (
    select 1 from servicos where rota_id = p_rota_id and status <> 'planejado'
  ) into v_tem_servico_iniciado;

  if v_tem_servico_iniciado then
    raise exception 'Essa rota já tem serviço iniciado por um técnico — a data não pode mais ser corrigida.';
  end if;

  select data into v_data_antiga from rotas where id = p_rota_id;

  if v_data_antiga is null then
    raise exception 'Rota não encontrada.';
  end if;

  update rotas set data = p_nova_data where id = p_rota_id;

  for v_chamado_id in
    select distinct chamado_id from servicos where rota_id = p_rota_id
  loop
    insert into historico (chamado_id, evento, descricao, criado_por)
    values (
      v_chamado_id,
      'rota_data_corrigida',
      format('Data da rota corrigida de %s para %s.', to_char(v_data_antiga, 'DD/MM/YYYY'), to_char(p_nova_data, 'DD/MM/YYYY')),
      auth.uid()
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. fn_registrar_resposta_tomticket — introduzida na 0028, mesmo defeito.
--    Corpo idêntico ao da 0028, só o guard muda.
-- -----------------------------------------------------------------------------
create or replace function fn_registrar_resposta_tomticket(
  p_servico_id  uuid,
  p_resposta_id text,
  p_tipo        text,
  p_mensagem    text,
  p_padrao      boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chamado_id     uuid;
  v_status         status_servico;
  v_ja_respondido  text;
  v_rotulo         text;
begin
  if fn_current_role() is distinct from 'gerente' then
    raise exception 'Só o gerente pode responder um chamado no TomTicket.';
  end if;

  if p_tipo not in ('conclusao', 'pendencia') then
    raise exception 'Tipo de resposta inválido.';
  end if;

  if p_resposta_id is null or btrim(p_resposta_id) = '' then
    raise exception 'O TomTicket não devolveu o identificador da resposta.';
  end if;

  select chamado_id, status, tomticket_resposta_id
    into v_chamado_id, v_status, v_ja_respondido
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;

  if v_ja_respondido is not null then
    raise exception 'Esse serviço já foi respondido no TomTicket.';
  end if;

  if p_tipo = 'conclusao' and v_status <> 'validado' then
    raise exception 'Só um serviço já validado pode ser respondido como conclusão.';
  end if;

  if p_tipo = 'pendencia' and v_status <> 'cancelado' then
    raise exception 'Só um serviço cancelado por pendência pode ser respondido como pendência.';
  end if;

  update servicos
     set tomticket_resposta_id = p_resposta_id
   where id = p_servico_id
     and tomticket_resposta_id is null;

  if not found then
    raise exception 'Esse serviço já foi respondido no TomTicket.';
  end if;

  v_rotulo := case
    when p_padrao then 'Mensagem padrão enviada ao TomTicket'
    else 'Mensagem escrita pelo gerente, enviada ao TomTicket'
  end;

  insert into historico (chamado_id, servico_id, evento, descricao, criado_por)
  values (
    v_chamado_id,
    p_servico_id,
    'tomticket_respondido',
    v_rotulo || ':' || chr(10) || chr(10) || coalesce(p_mensagem, ''),
    auth.uid()
  );
end;
$$;
