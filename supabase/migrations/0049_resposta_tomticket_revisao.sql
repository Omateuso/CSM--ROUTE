-- =============================================================================
-- Terceiro tipo de resposta ao TomTicket: "revisão" (pedido do usuário,
-- 14/09/2026) — chamado revisado pelo técnico (0047) precisa de uma
-- mensagem própria, sem finalizar (mesmo caminho da pendência: o serviço de
-- verdade ainda não foi feito, só a vistoria).
--
-- Assinatura de fn_registrar_resposta_tomticket não muda (mesmos 5
-- parâmetros) — `create or replace` direto, sem dropar.
-- =============================================================================

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
  v_categoria      text;
  v_ja_respondido  text;
  v_rotulo         text;
begin
  if fn_current_role() <> 'gerente' then
    raise exception 'Só o gerente pode responder um chamado no TomTicket.';
  end if;

  if p_tipo not in ('conclusao', 'pendencia', 'revisao') then
    raise exception 'Tipo de resposta inválido.';
  end if;

  if p_resposta_id is null or btrim(p_resposta_id) = '' then
    raise exception 'O TomTicket não devolveu o identificador da resposta.';
  end if;

  select chamado_id, status, categoria, tomticket_resposta_id
    into v_chamado_id, v_status, v_categoria, v_ja_respondido
  from servicos where id = p_servico_id;

  if not found then
    raise exception 'Serviço não encontrado.';
  end if;

  if v_ja_respondido is not null then
    raise exception 'Esse serviço já foi respondido no TomTicket.';
  end if;

  -- O estado é conferido aqui também, não só na tela: cada tipo de mensagem
  -- afirma algo diferente ao cliente sobre o que aconteceu, e mandar a
  -- errada é pior do que não mandar.
  if p_tipo = 'conclusao' and v_status <> 'validado' then
    raise exception 'Só um serviço já validado pode ser respondido como conclusão.';
  end if;

  if p_tipo = 'pendencia' and v_status <> 'cancelado' then
    raise exception 'Só um serviço cancelado por pendência pode ser respondido como pendência.';
  end if;

  if p_tipo = 'revisao' and (v_status <> 'validado' or v_categoria is distinct from 'revisao_tecnica') then
    raise exception 'Só um serviço revisado e já validado pode ser respondido como revisão.';
  end if;

  update servicos
     set tomticket_resposta_id = p_resposta_id
   where id = p_servico_id
     and tomticket_resposta_id is null;

  if not found then
    raise exception 'Esse serviço já foi respondido no TomTicket.';
  end if;

  -- Guarda o texto EFETIVAMENTE enviado. Depois do envio, este é o único lugar
  -- do nosso lado onde ele existe — a API não devolve o corpo da mensagem, e o
  -- gerente pode ter escrito um texto próprio em vez do padrão.
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
