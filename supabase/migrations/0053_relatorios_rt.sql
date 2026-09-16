-- =============================================================================
-- Relatório de RT (15/09/2026)
--
-- Documento técnico/operacional sobre uma RT específica, para encaminhamento
-- formal à gestão do IGEDES — NÃO é um chamado (não cria, edita ou substitui
-- nada em `chamados`/TomTicket). A situação pode ou não estar ligada a um
-- chamado existente (`chamado_id` é sempre opcional).
--
-- Decisões (plano aprovado pelo usuário em 15/09/2026):
--   1. Só `gerente` cria/edita/apaga (mesmo padrão do Relatório mensal CSM,
--      já exclusivo desse perfil). SELECT aberto pra qualquer autenticado —
--      convenção dominante no resto do schema (chamados/rts/evidencias).
--   2. Ciclo de vida por `status` ('rascunho' -> 'finalizado'), nunca hard
--      delete de um relatório finalizado. UPDATE/DELETE só passam a RLS
--      enquanto `status = 'rascunho'` — depois de finalizado, a linha fica
--      imutável de verdade (mesmo espírito de "rota confirmada é histórico
--      imutável", migration 0011), não só um botão escondido na UI.
--   3. Sem função `security definer`/RPC — é insert/update de uma linha só,
--      sem invariante entre tabelas que precise de transação (diferente de
--      fn_confirmar_rota/fn_registrar_urgencia). Inserts/updates diretos via
--      cliente Supabase, sob a RLS abaixo, bastam.
--   4. O `.docx` gerado nunca sobrescreve um arquivo já existente no Storage
--      (nome novo a cada geração, "{id}/relatorio-{timestamp}.docx") — não
--      existe policy de UPDATE em storage.objects em nenhum bucket deste
--      projeto, e não vale a pena abrir essa superfície só pra isto.
-- =============================================================================

create table relatorios_rt (
  id              uuid primary key default gen_random_uuid(),
  rt_id           uuid not null references rts(id) on delete restrict,
  chamado_id      uuid references chamados(id) on delete set null,   -- opcional, de propósito
  responsavel_id  uuid not null references profiles(id) on delete restrict,
  assunto         text,
  relato_tecnico  text,
  encaminhamento  text,
  status          text not null default 'rascunho' check (status in ('rascunho', 'finalizado')),
  docx_path       text,           -- preenchido só ao finalizar
  gerado_em       timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create index idx_relatorios_rt_rt on relatorios_rt (rt_id, criado_em);
create index idx_relatorios_rt_status on relatorios_rt (status);

create table relatorios_rt_fotos (
  id            uuid primary key default gen_random_uuid(),
  relatorio_id  uuid not null references relatorios_rt(id) on delete cascade,
  storage_path  text not null,
  legenda       text,
  ordem         integer not null,
  criado_em     timestamptz not null default now()
);

create index idx_relatorios_rt_fotos_relatorio on relatorios_rt_fotos (relatorio_id, ordem);

alter table relatorios_rt enable row level security;
alter table relatorios_rt_fotos enable row level security;

-- SELECT aberto pra qualquer autenticado (convenção dominante no schema) —
-- técnico não tem UI pra chegar aqui (sem link no menu, guard de página),
-- mas não há necessidade de restringir leitura de linha.
create policy "relatorios_rt_select_authenticated" on relatorios_rt
  for select to authenticated using (true);
create policy "relatorios_rt_fotos_select_authenticated" on relatorios_rt_fotos
  for select to authenticated using (true);

-- INSERT: só gerente.
create policy "relatorios_rt_insert_gerente" on relatorios_rt
  for insert to authenticated with check (fn_current_role() = 'gerente');

-- UPDATE: só gerente, e só enquanto a linha ainda é rascunho — permite a
-- própria transição rascunho -> finalizado (o `using` olha o estado ANTES do
-- update), mas depois de finalizado nenhum novo UPDATE passa no `using`.
create policy "relatorios_rt_update_gerente_rascunho" on relatorios_rt
  for update to authenticated
  using (fn_current_role() = 'gerente' and status = 'rascunho')
  with check (fn_current_role() = 'gerente');

-- DELETE: só gerente, só rascunho — descartar um rascunho é permitido;
-- apagar um relatório já finalizado, não (é documento institucional).
create policy "relatorios_rt_delete_gerente_rascunho" on relatorios_rt
  for delete to authenticated
  using (fn_current_role() = 'gerente' and status = 'rascunho');

-- Fotos: inserir/remover só enquanto o relatório pai ainda é rascunho.
create policy "relatorios_rt_fotos_insert_gerente_rascunho" on relatorios_rt_fotos
  for insert to authenticated with check (
    fn_current_role() = 'gerente'
    and exists (select 1 from relatorios_rt r where r.id = relatorio_id and r.status = 'rascunho')
  );
create policy "relatorios_rt_fotos_delete_gerente_rascunho" on relatorios_rt_fotos
  for delete to authenticated using (
    fn_current_role() = 'gerente'
    and exists (select 1 from relatorios_rt r where r.id = relatorio_id and r.status = 'rascunho')
  );

-- -----------------------------------------------------------------------------
-- Storage — bucket privado dedicado (mesmo padrão de urgencias-anexos,
-- migration 0027: as policies de `evidencias` são keyed por servico_id, que
-- não existe aqui). Fotos em "{relatorioId}/foto-{n}-{timestamp}-{arquivo}",
-- docx gerado em "{relatorioId}/relatorio-{timestamp}.docx" (nome novo a
-- cada geração, nunca upsert).
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'relatorios-rt',
  'relatorios-rt',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "relatorios_rt_storage_insert_gerente" on storage.objects for insert
  to authenticated with check (bucket_id = 'relatorios-rt' and fn_current_role() = 'gerente');

create policy "relatorios_rt_storage_select" on storage.objects for select
  to authenticated using (bucket_id = 'relatorios-rt' and fn_current_role() in ('gerente', 'gestao'));
