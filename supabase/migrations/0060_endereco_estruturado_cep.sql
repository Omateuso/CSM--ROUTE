-- =============================================================================
-- Endereço estruturado + CEP para RTs (pedido do usuário, documento de 24
-- seções, 16/09/2026) — fundação pra geocodificação substituir a digitação
-- manual de latitude/longitude no cadastro/troca de endereço de RT.
--
-- Contexto: não existe geocodificação nenhuma hoje — `rt-create-dialog.tsx`
-- e `rt-endereco-dialog.tsx` pedem lat/long em dois <input type="number">
-- crus, sem vínculo com o texto do endereço (achado real: 6 RTs com >0,8km
-- de erro, auditoria de 15/09/2026, scripts/diagnostico-coordenadas-rts.mjs).
-- Esta migration só adiciona as colunas; a lógica de geocodificação e a UI
-- vêm no código (lib/enderecos/, rt-create-dialog.tsx, rt-endereco-dialog.tsx).
--
-- `endereco`/`bairro` continuam existindo sem mudança de forma — lidos em
-- dezenas de lugares (busca de chamados, sincronização TomTicket por texto
-- de RT). As colunas novas são um COMPLEMENTO estruturado, não substituição.
-- Todas nullable: as 98 RTs reais não têm esse dado ainda (backfill via
-- planilha do usuário, fora desta migration — ainda não recebida).
--
-- `rts` e `rt_enderecos` espelham a mesma forma desde a 0005 (histórico de
-- endereços) — as colunas novas entram nas duas juntas, mesmo padrão.
-- =============================================================================

alter table rts
  add column cep          text,
  add column logradouro   text,
  add column numero       text,  -- não integer: endereço real tem "S/N", "Lote 12" etc.
  add column complemento  text,
  add column cidade       text,
  add column uf           text;

alter table rt_enderecos
  add column cep          text,
  add column logradouro   text,
  add column numero       text,
  add column complemento  text,
  add column cidade       text,
  add column uf           text;

-- -----------------------------------------------------------------------------
-- fn_criar_rt_com_endereco — assinatura muda (drop + create, mesmo padrão já
-- usado nas mudanças anteriores de assinatura desta função: 0007/0033/0046).
-- Os 6 parâmetros novos são `default null` — continua funcionando pra
-- qualquer chamada antiga que não os informe.
-- -----------------------------------------------------------------------------
drop function if exists fn_criar_rt_com_endereco(text, text, text, text, uuid, uuid, numeric, numeric, boolean);

create or replace function fn_criar_rt_com_endereco(
  p_codigo       text,
  p_nome         text,
  p_endereco     text,
  p_bairro       text,
  p_regiao_id    uuid,
  p_caps_id      uuid,
  p_latitude     numeric,
  p_longitude    numeric,
  p_ativo        boolean default true,
  p_cep          text default null,
  p_logradouro   text default null,
  p_numero       text default null,
  p_complemento  text default null,
  p_cidade       text default null,
  p_uf           text default null
) returns uuid
language plpgsql
as $$
declare
  v_rt_id uuid;
begin
  insert into rts (
    codigo, nome, endereco, bairro, regiao_id, caps_id, latitude, longitude, ativo,
    cep, logradouro, numero, complemento, cidade, uf
  ) values (
    p_codigo, p_nome, p_endereco, p_bairro, p_regiao_id, p_caps_id, p_latitude, p_longitude, p_ativo,
    p_cep, p_logradouro, p_numero, p_complemento, p_cidade, p_uf
  )
  returning id into v_rt_id;

  insert into rt_enderecos (
    rt_id, endereco, bairro, regiao_id, latitude, longitude,
    cep, logradouro, numero, complemento, cidade, uf,
    vigente_desde, vigente_ate, motivo, criado_por
  ) values (
    v_rt_id, p_endereco, p_bairro, p_regiao_id, p_latitude, p_longitude,
    p_cep, p_logradouro, p_numero, p_complemento, p_cidade, p_uf,
    current_date, null, 'Cadastro inicial da RT', auth.uid()
  );

  return v_rt_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- fn_trocar_endereco_rt — mesma mudança de assinatura, mesmo padrão.
-- -----------------------------------------------------------------------------
drop function if exists fn_trocar_endereco_rt(uuid, text, text, uuid, numeric, numeric, text, date);

create or replace function fn_trocar_endereco_rt(
  p_rt_id         uuid,
  p_endereco      text,
  p_bairro        text,
  p_regiao_id     uuid,
  p_latitude      numeric,
  p_longitude     numeric,
  p_motivo        text default null,
  p_vigente_desde date default current_date,
  p_cep           text default null,
  p_logradouro    text default null,
  p_numero        text default null,
  p_complemento   text default null,
  p_cidade        text default null,
  p_uf            text default null
) returns uuid
language plpgsql
as $$
declare
  v_novo_id uuid;
begin
  update rt_enderecos
    set vigente_ate = p_vigente_desde
    where rt_id = p_rt_id and vigente_ate is null;

  insert into rt_enderecos (
    rt_id, endereco, bairro, regiao_id, latitude, longitude,
    cep, logradouro, numero, complemento, cidade, uf,
    vigente_desde, vigente_ate, motivo, criado_por
  ) values (
    p_rt_id, p_endereco, p_bairro, p_regiao_id, p_latitude, p_longitude,
    p_cep, p_logradouro, p_numero, p_complemento, p_cidade, p_uf,
    p_vigente_desde, null, p_motivo, auth.uid()
  )
  returning id into v_novo_id;

  update rts
    set endereco      = p_endereco,
        bairro        = p_bairro,
        regiao_id     = p_regiao_id,
        latitude      = p_latitude,
        longitude     = p_longitude,
        cep           = p_cep,
        logradouro    = p_logradouro,
        numero        = p_numero,
        complemento   = p_complemento,
        cidade        = p_cidade,
        uf            = p_uf,
        atualizado_em = now()
    where id = p_rt_id;

  return v_novo_id;
end;
$$;
