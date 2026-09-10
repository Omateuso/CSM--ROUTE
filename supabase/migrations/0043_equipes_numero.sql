-- =============================================================================
-- Número da equipe — 10/09/2026
--
-- RENUMERADA de 0040 para 0043 no merge de 10/09/2026: o repositório remoto
-- já tinha uma 0040 diferente (reexecucao_nao_reentra_sozinha), criada em
-- paralelo. Só o número do arquivo mudou; o SQL é o mesmo que JÁ FOI
-- APLICADO em 10/09 — NÃO rodar de novo (o `add column` falharia).
--
-- Pedido do usuário: o pino do técnico no mapa da "Rota do dia" passa a
-- mostrar o número da equipe, pro gerente/gestão identificarem quem é quem
-- sem passar o mouse em cada pino.
--
-- Por que uma coluna e não regex no nome: hoje as equipes se chamam
-- "equipe 1 - ZO" e "equipe 2 - ZN", então dava pra extrair o número do
-- texto — mas isso é identificador operacional, e amarrá-lo à forma como
-- alguém digitou o nome significa que "Equipe Norte" apareceria sem
-- rótulo no mapa, sem erro e sem aviso. Decisão confirmada com o usuário.
--
-- RLS: nenhuma policy nova. `equipes` já é INSERT/UPDATE exclusivo de
-- `gerente` desde a 0010 — coluna nova numa tabela existente herda isso.
-- =============================================================================

alter table equipes add column numero smallint;

-- 1) Candidato: o primeiro número que aparecer no nome atual.
-- Limitado a 4 dígitos de propósito: `numero` é smallint (teto 32767), e um
-- nome com um número gigante faria o cast estourar e abortar a migration.
update equipes set numero = nullif(substring(nome from '[0-9]{1,4}'), '')::smallint;

-- 2) Desempate. Dois nomes podem conter o mesmo número ("equipe 1 - ZO" e
--    "equipe 1 - ZN"); a mais antiga fica com ele, as outras voltam pra fila.
with ranqueadas as (
  select id, row_number() over (partition by numero order by criado_em, id) as posicao
  from equipes
  where numero is not null
)
update equipes e
set numero = null
from ranqueadas r
where e.id = r.id and r.posicao > 1;

-- 3) Quem ficou sem número (nome sem dígito, ou perdeu o desempate) recebe
--    o próximo livre, na ordem de criação.
with base as (
  select coalesce(max(numero), 0) as maior from equipes
),
fila as (
  select id, row_number() over (order by criado_em, id) as seq
  from equipes
  where numero is null
)
update equipes e
set numero = base.maior + fila.seq
from fila, base
where e.id = fila.id;

-- 4) Trava de segurança antes do NOT NULL — mesmo padrão da 0007 (aborta a
--    migration inteira em vez de deixar a tabela num estado meio migrado).
do $$
begin
  if exists (select 1 from equipes where numero is null) then
    raise exception 'Sobrou equipe sem numero depois do backfill — abortando.';
  end if;
end $$;

alter table equipes alter column numero set not null;

-- Único porque é identificador: duas equipes "2" no mapa não identificam
-- ninguém. Reaproveitar o número de uma equipe apagada é permitido.
alter table equipes add constraint equipes_numero_unico unique (numero);
