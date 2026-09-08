-- =============================================================================
-- Coleta direta do TomTicket (pedido do usuário, 08/09/2026)
--
-- Substitui o workflow manual de exportar a Busca Avançada em planilha e me
-- mandar todo dia (ver "Estado atual", Fase 1 B3). O problema prático: chamado
-- novo só aparecia aqui quando o usuário lembrava de exportar.
--
-- Decisões confirmadas com o usuário antes de codar:
--   1. A sync INSERE novos E ATUALIZA existentes (status/prioridade/assunto).
--      É o que faz `chamados.status` voltar a espelhar o TomTicket de verdade.
--   2. Chamado cuja RT não bate com nenhuma cadastrada NÃO entra, mas fica
--      registrado em `sync_nao_importados` com o motivo — nada entra errado e
--      nada some em silêncio.
--
-- A ARMADILHA QUE ESTA SYNC EVITA (documentada na base-automatizacao, e que já
-- aconteceu de verdade no programa de onde ela saiu): a leitura incremental
-- óbvia seria "me dê os chamados ABERTOS que mudaram desde a última vez". Está
-- errada — quando um chamado é finalizado ele deixa de ser aberto e não volta
-- na resposta, então o sistema nunca fica sabendo e segue mostrando uma parada
-- de rota já resolvida. Lá foram 80 chamados fantasma. Por isso a leitura NÃO
-- filtra situação: pede tudo que mudou e decide aqui.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Relógio da coleta
--
-- Linha única (o `check (id)` com default true impede uma segunda). Guarda até
-- onde já lemos: a próxima leitura pede a partir daí e custa quase nada.
--
-- `ultima_leitura` NÃO avança quando a coleta falha — senão a próxima passada
-- pularia justamente a janela que deu erro, e aquele chamado ficaria invisível
-- pra sempre.
-- -----------------------------------------------------------------------------
create table sync_estado (
  id              boolean primary key default true check (id),
  ultima_leitura  timestamptz,
  ultima_execucao timestamptz,
  ultimo_erro     text,
  novos           integer not null default 0,
  atualizados     integer not null default 0,
  ignorados       integer not null default 0
);

insert into sync_estado (id) values (true);

alter table sync_estado enable row level security;

create policy "sync_estado_select_gerente_gestao" on sync_estado
  for select to authenticated using (fn_current_role() in ('gerente', 'gestao'));

create policy "sync_estado_update_gerente" on sync_estado
  for update to authenticated
  using (fn_current_role() = 'gerente')
  with check (fn_current_role() = 'gerente');

-- -----------------------------------------------------------------------------
-- 2. O que não deu pra importar
--
-- Um chamado de RT desconhecida não pode entrar (`chamados.rt_id` é NOT NULL e
-- inventar RT quebraria rota e mapa), mas também não pode sumir calado — é
-- exatamente o defeito invisível do import por planilha de hoje.
--
-- Chaveado pelo protocolo: a mesma leitura repetida atualiza a linha em vez de
-- empilhar duplicata. Quando a RT é cadastrada e o chamado finalmente entra, a
-- linha é apagada pela própria sync.
-- -----------------------------------------------------------------------------
create table sync_nao_importados (
  tomticket_id  text primary key,
  ticket_id     text,
  assunto       text,
  cliente_nome  text,
  motivo        text not null,
  visto_em      timestamptz not null default now()
);

alter table sync_nao_importados enable row level security;

create policy "sync_nao_importados_select_gerente_gestao" on sync_nao_importados
  for select to authenticated using (fn_current_role() in ('gerente', 'gestao'));

create policy "sync_nao_importados_insert_gerente" on sync_nao_importados
  for insert to authenticated with check (fn_current_role() = 'gerente');

create policy "sync_nao_importados_update_gerente" on sync_nao_importados
  for update to authenticated
  using (fn_current_role() = 'gerente')
  with check (fn_current_role() = 'gerente');

create policy "sync_nao_importados_delete_gerente" on sync_nao_importados
  for delete to authenticated using (fn_current_role() = 'gerente');

-- -----------------------------------------------------------------------------
-- 3. Chave estável da RT no TomTicket
--
-- Hoje o casamento é pelo `codigo` da RT (ex.: "SRT 65") contra o nome do
-- cliente que a API devolve. Funciona, mas depende de texto digitado igual dos
-- dois lados. `customer.internal_id` do TomTicket é um identificador estável;
-- quando estiver preenchido aqui, a sync prefere ele e o nome vira só fallback.
--
-- Nullable e sem backfill de propósito: só dá pra preencher depois de ler uma
-- página real da API (o token ainda não existe). Nada quebra enquanto estiver
-- vazio.
-- -----------------------------------------------------------------------------
alter table rts add column tomticket_customer_id text;

create unique index idx_rts_tomticket_customer on rts (tomticket_customer_id)
  where tomticket_customer_id is not null;
