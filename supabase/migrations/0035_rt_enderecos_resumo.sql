-- =============================================================================
-- Resumo operacional por período de endereço de uma RT
-- (Fase 2 da evolução operacional, seção 2 — pedido do usuário 09/09/2026)
--
-- Uma RT muda de imóvel ao longo do tempo. `chamados.rt_id` aponta pra
-- identidade permanente da RT (por isso o histórico não se perde), e
-- `rt_enderecos` (0005) guarda todo endereço que ela já teve, com o período
-- em que esteve vigente (`vigente_desde` / `vigente_ate`, `NULL` = atual).
--
-- Esta função atribui cada chamado ao endereço que estava vigente QUANDO ELE
-- FOI CRIADO — nunca mistura os chamados do endereço antigo com os do novo.
-- É o que a tela de detalhe da RT usa pra mostrar "Endereço anterior /
-- Período / Chamados registrados" separado do endereço atual.
--
-- ATRIBUIÇÃO (um chamado cai em exatamente um período):
--   * período [vigente_desde, vigente_ate): criado_em::date no intervalo
--     (vigente_ate é o dia em que o endereço PAROU de valer — exclusivo,
--      igual fn_trocar_endereco_rt grava);
--   * chamado ANTERIOR a qualquer endereço registrado cai no PRIMEIRO período.
--     Necessário porque o backfill da 0005 pôs `vigente_desde = data de
--     criação da RT no sistema` (ago/2026), mas os chamados importados do
--     TomTicket vão até 2023 — sem esse ramo, milhares de chamados antigos
--     ficariam fora de todos os períodos.
--
-- security invoker (padrão): roda com a RLS de quem chama. `chamados` e
-- `rt_enderecos` liberam SELECT pra qualquer autenticado (0001/0005), então
-- gestão/gerente/técnico conseguem consultar — sem o furo de `security
-- definer` que a 0021 corrigiu na view do relatório diário.
-- =============================================================================

create or replace function fn_rt_enderecos_resumo(p_rt_id uuid)
returns table (
  endereco_id           uuid,
  endereco              text,
  bairro                text,
  regiao_nome           text,
  vigente_desde         date,
  vigente_ate           date,
  atual                 boolean,
  motivo                text,
  chamados_criados      bigint,
  chamados_finalizados  bigint,
  chamados_abertos      bigint
)
language sql
stable
as $$
  with primeiro as (
    select min(vigente_desde) as desde from rt_enderecos where rt_id = p_rt_id
  )
  select
    e.id,
    e.endereco,
    e.bairro,
    reg.nome,
    e.vigente_desde,
    e.vigente_ate,
    e.vigente_ate is null                                            as atual,
    e.motivo,
    count(c.id)                                                      as chamados_criados,
    count(c.id) filter (where c.status = 'finalizado')               as chamados_finalizados,
    count(c.id) filter (where c.status in ('aberto', 'em_andamento')) as chamados_abertos
  from rt_enderecos e
  join regioes reg on reg.id = e.regiao_id
  cross join primeiro p
  left join chamados c
    on c.rt_id = e.rt_id
   and (
        (c.criado_em::date >= e.vigente_desde
         and (e.vigente_ate is null or c.criado_em::date < e.vigente_ate))
        or (e.vigente_desde = p.desde and c.criado_em::date < e.vigente_desde)
       )
  where e.rt_id = p_rt_id
  group by e.id, e.endereco, e.bairro, reg.nome, e.vigente_desde, e.vigente_ate, e.motivo, e.criado_em
  order by e.vigente_desde desc, e.criado_em desc;
$$;
