-- =============================================================================
-- Fase 1 -- Base Operacional
-- Cadastro de CAPS (Centro de Atencao Psicossocial) -- e o "cliente" no
-- TomTicket: cada CAPS tem um conjunto de RTs sob sua responsabilidade.
-- Uma RT pertence a exatamente um CAPS por vez (sem historico -- diferente
-- do endereco, isso nao foi pedido; se precisar rastrear troca de CAPS no
-- futuro, seguir o mesmo padrao de rt_enderecos).
--
-- Exclusivo do perfil gestao pra escrita, mesmo padrao de rts (migration
-- 0006) -- faz sentido em conjunto: quem cadastra/edita RT agora tambem e
-- responsavel por saber a qual CAPS ela pertence.
-- =============================================================================

create table caps (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null unique,
  criado_em timestamptz not null default now()
);

alter table caps enable row level security;

create policy "caps_select_authenticated" on caps for select to authenticated using (true);
create policy "caps_insert_gestao" on caps for insert to authenticated with check (fn_current_role() = 'gestao');
create policy "caps_update_gestao" on caps for update to authenticated
  using (fn_current_role() = 'gestao') with check (fn_current_role() = 'gestao');

insert into caps (nome) values
  ('CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 1'),
  ('CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 2'),
  ('CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 3'),
  ('CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 4'),
  ('CAPS CARLOS AUGUSTO MAGAL'),
  ('CAPS CLARICE LISPECTOR SEGMENTO 1'),
  ('CAPS CLARICE LISPECTOR SEGMENTO 2'),
  ('CAPS DIRCINHA E LINDA BATISTA'),
  ('CAPS ERNESTO NAZARETH'),
  ('CAPS FERNANDO DINIZ'),
  ('CAPS FRANCO BASAGLIA'),
  ('CAPS JOÃO FERREIRA'),
  ('CAPS LIMA BARRETO'),
  ('CAPS MANOEL BARROS SEGMENTO 1'),
  ('CAPS MANOEL BARROS SEGMENTO 2'),
  ('CAPS MANOEL BARROS SEGMENTO 3'),
  ('CAPS MANOEL BARROS SEGMENTO 4'),
  ('CAPS MARIA DO SOCORRO'),
  ('CAPS NEUSA SANTOS SOUZA'),
  ('CAPS PEDRO PELLEGRINO'),
  ('CAPS PROFETA GENTILEZA'),
  ('CAPS RUBENS CORREA'),
  ('CAPS SEVERINO DOS SANTOS'),
  ('CAPS SIMÃO BACAMARTE'),
  ('CAPS TORQUATO NETO'),
  ('CAPS UERJ');

alter table rts add column caps_id uuid references caps(id) on delete restrict;

update rts set caps_id = c.id
from caps c, (values
  ('SRT 1', 'CAPS RUBENS CORREA'),
  ('SRT 2', 'CAPS CLARICE LISPECTOR SEGMENTO 1'),
  ('SRT 3', 'CAPS CLARICE LISPECTOR SEGMENTO 1'),
  ('SRT 4', 'CAPS CLARICE LISPECTOR SEGMENTO 2'),
  ('SRT 5', 'CAPS CLARICE LISPECTOR SEGMENTO 1'),
  ('SRT 6', 'CAPS CLARICE LISPECTOR SEGMENTO 1'),
  ('SRT 7', 'CAPS CLARICE LISPECTOR SEGMENTO 2'),
  ('SRT 8', 'CAPS DIRCINHA E LINDA BATISTA'),
  ('SRT 9', 'CAPS JOÃO FERREIRA'),
  ('SRT 10', 'CAPS CLARICE LISPECTOR SEGMENTO 1'),
  ('SRT 11', 'CAPS FERNANDO DINIZ'),
  ('SRT 12', 'CAPS TORQUATO NETO'),
  ('SRT 13', 'CAPS JOÃO FERREIRA'),
  ('SRT 14', 'CAPS MARIA DO SOCORRO'),
  ('SRT 15', 'CAPS ERNESTO NAZARETH'),
  ('SRT 16', 'CAPS UERJ'),
  ('SRT 17', 'CAPS RUBENS CORREA'),
  ('SRT 18', 'CAPS RUBENS CORREA'),
  ('SRT 19', 'CAPS UERJ'),
  ('SRT 20', 'CAPS JOÃO FERREIRA'),
  ('SRT 21', 'CAPS LIMA BARRETO'),
  ('SRT 22', 'CAPS MANOEL BARROS SEGMENTO 2'),
  ('SRT 23', 'CAPS LIMA BARRETO'),
  ('SRT 24', 'CAPS SEVERINO DOS SANTOS'),
  ('SRT 25', 'CAPS PROFETA GENTILEZA'),
  ('SRT 26', 'CAPS SIMÃO BACAMARTE'),
  ('SRT 27', 'CAPS PEDRO PELLEGRINO'),
  ('SRT 28', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 4'),
  ('SRT 29', 'CAPS MANOEL BARROS SEGMENTO 3'),
  ('SRT 30', 'CAPS PROFETA GENTILEZA'),
  ('SRT 31', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 2'),
  ('SRT 32', 'CAPS DIRCINHA E LINDA BATISTA'),
  ('SRT 33', 'CAPS MANOEL BARROS SEGMENTO 1'),
  ('SRT 34', 'CAPS SEVERINO DOS SANTOS'),
  ('SRT 35', 'CAPS ERNESTO NAZARETH'),
  ('SRT 36', 'CAPS SIMÃO BACAMARTE'),
  ('SRT 37', 'CAPS PEDRO PELLEGRINO'),
  ('SRT 38', 'CAPS MANOEL BARROS SEGMENTO 2'),
  ('SRT 39', 'CAPS SEVERINO DOS SANTOS'),
  ('SRT 40', 'CAPS MANOEL BARROS SEGMENTO 3'),
  ('SRT 41', 'CAPS MANOEL BARROS SEGMENTO 3'),
  ('SRT 42', 'CAPS PEDRO PELLEGRINO'),
  ('SRT 43', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 2'),
  ('SRT 44', 'CAPS ERNESTO NAZARETH'),
  ('SRT 45', 'CAPS SEVERINO DOS SANTOS'),
  ('SRT 46', 'CAPS MANOEL BARROS SEGMENTO 1'),
  ('SRT 47', 'CAPS MANOEL BARROS SEGMENTO 1'),
  ('SRT 48', 'CAPS SIMÃO BACAMARTE'),
  ('SRT 49', 'CAPS MANOEL BARROS SEGMENTO 1'),
  ('SRT 50', 'CAPS CARLOS AUGUSTO MAGAL'),
  ('SRT 51', 'CAPS MANOEL BARROS SEGMENTO 4'),
  ('SRT 52', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 3'),
  ('SRT 53', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 4'),
  ('SRT 54', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 3'),
  ('SRT 55', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 3'),
  ('SRT 56', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 3'),
  ('SRT 57', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 2'),
  ('SRT 58', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 1'),
  ('SRT 59', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 1'),
  ('SRT 60', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 2'),
  ('SRT 61', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 4'),
  ('SRT 62', 'CAPS LIMA BARRETO'),
  ('SRT 63', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 1'),
  ('SRT 64', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 1'),
  ('SRT 65', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 1'),
  ('SRT 66', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 4'),
  ('SRT 67', 'CAPS ERNESTO NAZARETH'),
  ('SRT 68', 'CAPS DIRCINHA E LINDA BATISTA'),
  ('SRT 69', 'CAPS FRANCO BASAGLIA'),
  ('SRT 70', 'CAPS FERNANDO DINIZ'),
  ('SRT 71', 'CAPS CLARICE LISPECTOR SEGMENTO 2'),
  ('SRT 72', 'CAPS ARTHUR BISPO DO ROSÁRIO SEGMENTO 2'),
  ('SRT 73', 'CAPS TORQUATO NETO'),
  ('SRT 74', 'CAPS RUBENS CORREA'),
  ('SRT 75', 'CAPS PEDRO PELLEGRINO'),
  ('SRT 76', 'CAPS SIMÃO BACAMARTE'),
  ('SRT 77', 'CAPS MANOEL BARROS SEGMENTO 4'),
  ('SRT 78', 'CAPS MANOEL BARROS SEGMENTO 4'),
  ('SRT 79', 'CAPS MANOEL BARROS SEGMENTO 2'),
  ('SRT 80', 'CAPS MANOEL BARROS SEGMENTO 2'),
  ('SRT 81', 'CAPS MANOEL BARROS SEGMENTO 2'),
  ('SRT 82', 'CAPS MANOEL BARROS SEGMENTO 4'),
  ('SRT 83', 'CAPS MANOEL BARROS SEGMENTO 4'),
  ('SRT 84', 'CAPS FRANCO BASAGLIA'),
  ('SRT 85', 'CAPS LIMA BARRETO'),
  ('SRT 86', 'CAPS FERNANDO DINIZ'),
  ('SRT 87', 'CAPS CLARICE LISPECTOR SEGMENTO 2'),
  ('SRT 88', 'CAPS PROFETA GENTILEZA'),
  ('SRT 89', 'CAPS NEUSA SANTOS SOUZA'),
  ('SRT 90', 'CAPS JOÃO FERREIRA'),
  ('SRT 91', 'CAPS NEUSA SANTOS SOUZA'),
  ('SRT 92', 'CAPS FERNANDO DINIZ'),
  ('SRT 93', 'CAPS TORQUATO NETO'),
  ('SRT 94', 'CAPS MARIA DO SOCORRO'),
  ('SRT 95', 'CAPS CARLOS AUGUSTO MAGAL'),
  ('SRT 96', 'CAPS RUBENS CORREA'),
  ('SRT 97', 'CAPS JOÃO FERREIRA'),
  ('SRT 99', 'CAPS TORQUATO NETO')
) as m(codigo, caps_nome)
where rts.codigo = m.codigo and c.nome = m.caps_nome;

-- confirma que todas as RTs ganharam um caps_id antes de travar not null
do $$
declare
  v_faltando integer;
begin
  select count(*) into v_faltando from rts where caps_id is null;
  if v_faltando > 0 then
    raise exception '% RT(s) sem caps_id apos o backfill -- abortando antes do NOT NULL', v_faltando;
  end if;
end $$;

alter table rts alter column caps_id set not null;

create index idx_rts_caps on rts (caps_id);

-- fn_criar_rt_com_endereco (migration 0005) precisa saber de caps_id agora
-- que a coluna existe e e obrigatoria. Assinatura mudou (novo parametro no
-- meio) -- drop explicito antes do create, pra nao arriscar ambiguidade de
-- overload com a versao antiga.
drop function fn_criar_rt_com_endereco(text, text, text, text, uuid, numeric, numeric, boolean);

create or replace function fn_criar_rt_com_endereco(
  p_codigo    text,
  p_nome      text,
  p_endereco  text,
  p_bairro    text,
  p_regiao_id uuid,
  p_caps_id   uuid,
  p_latitude  numeric,
  p_longitude numeric,
  p_ativo     boolean default true
) returns uuid
language plpgsql
as $$
declare
  v_rt_id uuid;
begin
  insert into rts (codigo, nome, endereco, bairro, regiao_id, caps_id, latitude, longitude, ativo)
  values (p_codigo, p_nome, p_endereco, p_bairro, p_regiao_id, p_caps_id, p_latitude, p_longitude, p_ativo)
  returning id into v_rt_id;

  insert into rt_enderecos (
    rt_id, endereco, bairro, regiao_id, latitude, longitude,
    vigente_desde, vigente_ate, motivo, criado_por
  ) values (
    v_rt_id, p_endereco, p_bairro, p_regiao_id, p_latitude, p_longitude,
    current_date, null, 'Cadastro inicial da RT', auth.uid()
  );

  return v_rt_id;
end;
$$;
