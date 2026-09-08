-- =============================================================================
-- Resposta automática no TomTicket (pedido do usuário, 08/09/2026)
--
-- Fecha o último passo manual do fluxo: hoje o gerente valida o serviço aqui,
-- abre o TomTicket em outra aba, copia o texto do técnico, baixa a OS e anexa
-- tudo na mão. Com a API v2.0 (`POST /v2.0/ticket/reply/operator`) o sistema
-- responde o chamado e sobe os anexos direto da tela de Validação e da tela
-- de Pendências.
--
-- ESCOPO DELIBERADO: só RESPONDER, nunca finalizar. Confirmado com o usuário —
-- quem finaliza chamado no TomTicket é outra pessoa. O endpoint
-- `/ticket/finish` existe e NÃO deve ser usado por este sistema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Cache do id interno do TomTicket
--
-- `chamados.tomticket_id` guarda o PROTOCOLO (o número que aparece na tela,
-- ex.: 322810) — foi o que veio no export da Busca Avançada. A API, porém,
-- exige o `id` interno em `ticket_id`: na resposta de `/ticket/list` eles são
-- dois atributos DIFERENTES (`protocol` e `id`). Resolver o protocolo custa uma
-- requisição; guardar aqui faz isso acontecer uma vez por chamado, não a cada
-- envio. Nullable de propósito: os 995 chamados já importados nascem sem ele e
-- vão sendo preenchidos sob demanda.
-- -----------------------------------------------------------------------------
alter table chamados add column tomticket_ticket_id text;

-- -----------------------------------------------------------------------------
-- 2. Recibo + trava de idempotência
--
-- Guarda o `id` que a API devolve ao aceitar a resposta. Serve pra duas coisas
-- ao mesmo tempo: comprovante de que a mensagem foi aceita, e trava contra
-- envio duplicado — o que importa aqui porque isso escreve no chamado que a
-- iGEDES lê, e não existe "desenviar".
--
-- Uma coluna cobre os dois fluxos (conclusão e pendência) porque um serviço ou
-- conclui (`validado`) ou é cancelado por pendência (`cancelado`) — nunca os
-- dois. Se o chamado voltar numa rota nova, é outro `servico`, com resposta
-- própria: o cliente vê "faltou material" e, depois, "concluído". É o
-- comportamento desejado, não uma brecha.
-- -----------------------------------------------------------------------------
alter table servicos add column tomticket_resposta_id text;

-- -----------------------------------------------------------------------------
-- 3. fn_registrar_resposta_tomticket
--
-- `security definer` pelo mesmo motivo da 0016 (`fn_corrigir_data_rota`): não
-- existe — nem deve existir — policy de UPDATE genérica em `servicos`. Se
-- existisse, um gerente poderia escrever qualquer coluna por chamada direta à
-- API. Todo o controle fica aqui dentro.
--
-- Só é chamada DEPOIS que a API do TomTicket aceitou a mensagem. A trava real
-- é o `where tomticket_resposta_id is null` do UPDATE: dois cliques
-- simultâneos, só um grava.
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
  if fn_current_role() <> 'gerente' then
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

  -- O estado é conferido aqui também, não só na tela: a mensagem de conclusão
  -- afirma ao cliente que o serviço foi feito, e a de pendência afirma que não
  -- foi. Mandar a errada é pior do que não mandar.
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
