-- =============================================================================
-- Respostas e anexos do cliente vindos do TomTicket
-- (Fase 3 da evolução operacional, seções 9/10/11 — pedido do usuário 09/09/2026)
--
-- Hoje a sync (0030, lib/tomticket/coletor.ts) só lê os campos do chamado. A
-- resposta do `/ticket/detail` traz muito mais e de graça (mesma requisição):
--   ticket.attachments[]  -> {name, url, size}  fotos que o cliente anexou AO ABRIR
--   ticket.replies[]       -> {id, sender_type ("C"=cliente / "A"=atendente),
--                              message (HTML), sender, date, attachments[]}
--
-- `reply.id` é um hex estável — vira a chave de dedup. `date` vem no formato
-- "YYYY-MM-DD HH:MM:SS-03" (offset PHP). URLs de anexo são S3 público sem
-- assinatura; a sync BAIXA cada arquivo pro bucket privado `respostas-cliente`
-- (decisão do usuário: nada depende de o TomTicket manter o arquivo no ar).
--
-- Sino global de "novas respostas": conta `chamado_respostas` de tipo
-- 'cliente' com `visto_em is null`. Realtime na tabela (decisão do usuário).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Respostas (cliente e atendente) de um chamado
-- -----------------------------------------------------------------------------
create table chamado_respostas (
  id                  uuid primary key default gen_random_uuid(),
  chamado_id          uuid not null references chamados(id) on delete cascade,
  tomticket_reply_id  text not null,                              -- reply.id
  tipo                text not null check (tipo in ('cliente', 'atendente')),
  remetente           text,                                       -- reply.sender
  mensagem            text,                                       -- textoDeHtml(reply.message)
  respondido_em       timestamptz,                                -- reply.date parseado
  visto_em            timestamptz,                                -- gerente/gestão marcou como visto (null = não visto)
  criado_em           timestamptz not null default now(),
  unique (chamado_id, tomticket_reply_id)
);

create index idx_chamado_respostas_chamado on chamado_respostas (chamado_id, respondido_em);
-- índice parcial que alimenta o contador do sino
create index idx_chamado_respostas_nao_vistas
  on chamado_respostas (visto_em)
  where tipo = 'cliente' and visto_em is null;

alter table chamado_respostas enable row level security;
alter table chamado_respostas replica identity full;  -- Realtime (padrão da 0020)

-- gerente/gestão veem tudo; técnico só as respostas de um chamado que ele atende
create policy "chamado_respostas_select" on chamado_respostas for select to authenticated using (
  fn_current_role() in ('gerente', 'gestao')
  or exists (
    select 1 from servicos s
    where s.chamado_id = chamado_respostas.chamado_id and s.tecnico_id = auth.uid()
  )
);

-- gerente/gestão marcam como visto (via fn_marcar_respostas_vistas). Sem
-- restrição de coluna na policy — a função é quem garante que só `visto_em` muda.
create policy "chamado_respostas_update_gestao" on chamado_respostas for update to authenticated
  using (fn_current_role() in ('gerente', 'gestao'))
  with check (fn_current_role() in ('gerente', 'gestao'));

-- SEM policy de insert pra authenticated: só a sync grava (service role).

-- -----------------------------------------------------------------------------
-- 2. Anexos do cliente — da abertura do chamado e das respostas
-- -----------------------------------------------------------------------------
create table chamado_anexos_cliente (
  id            uuid primary key default gen_random_uuid(),
  chamado_id    uuid not null references chamados(id) on delete cascade,
  resposta_id   uuid references chamado_respostas(id) on delete cascade,  -- null = anexo da abertura
  origem        text not null check (origem in ('abertura', 'resposta')),
  nome          text not null,
  tamanho       bigint,
  storage_path  text not null,                                            -- caminho no bucket 'respostas-cliente'
  tomticket_url text not null,                                            -- URL de origem — chave de dedup
  criado_em     timestamptz not null default now(),
  unique (chamado_id, tomticket_url)
);

create index idx_chamado_anexos_cliente_chamado on chamado_anexos_cliente (chamado_id);

alter table chamado_anexos_cliente enable row level security;

create policy "chamado_anexos_cliente_select" on chamado_anexos_cliente for select to authenticated using (
  fn_current_role() in ('gerente', 'gestao')
  or exists (
    select 1 from servicos s
    where s.chamado_id = chamado_anexos_cliente.chamado_id and s.tecnico_id = auth.uid()
  )
);
-- insert só pela sync (service role).

-- -----------------------------------------------------------------------------
-- 3. Bucket privado pros arquivos baixados do TomTicket
--    Path: "{chamado_id}/{origem}-{reply_id|abertura}-{i}-{nome}" — o 1º
--    segmento é o chamado_id, é o que as policies checam via storage.foldername.
--    Sem allowed_mime_types: o cliente anexa o que quiser (foto, PDF, doc...).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('respostas-cliente', 'respostas-cliente', false, 26214400)  -- 25 MB
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

create policy "respostas_cliente_storage_select" on storage.objects for select to authenticated using (
  bucket_id = 'respostas-cliente'
  and (
    fn_current_role() in ('gerente', 'gestao')
    or exists (
      select 1 from servicos s
      where s.chamado_id::text = (storage.foldername(name))[1] and s.tecnico_id = auth.uid()
    )
  )
);
-- sem insert/update/delete pra authenticated: só a sync (service role) escreve.

-- -----------------------------------------------------------------------------
-- 4. Marcar as respostas do cliente de um chamado como vistas
-- -----------------------------------------------------------------------------
create or replace function fn_marcar_respostas_vistas(p_chamado_id uuid)
returns void
language plpgsql
as $$
begin
  if fn_current_role() not in ('gerente', 'gestao') then
    raise exception 'Sem permissão pra marcar respostas como vistas.';
  end if;

  update chamado_respostas
     set visto_em = now()
   where chamado_id = p_chamado_id
     and tipo = 'cliente'
     and visto_em is null;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Realtime
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table chamado_respostas;
