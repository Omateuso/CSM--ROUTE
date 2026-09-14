# CSM ROUTE — Gestão Operacional de Manutenção das RTs

Plataforma que organiza a manutenção predial das Residências Terapêuticas (RTs)
administradas pela iGEDES e atendidas pela CSM.

**Não substitui o TomTicket** — é a camada operacional entre "chamado aberto" e
"chamado respondido": planeja rotas, captura a execução em campo (foto, OS,
observação, geolocalização) no momento em que ela acontece, e devolve o
resultado ao TomTicket com os anexos.

Três perfis, três interfaces:

| Perfil | O que faz |
|---|---|
| **Gerente** | Monta e confirma rotas, acompanha a execução, valida os serviços |
| **Técnico** | Tela mobile enxuta: vê os serviços do dia, inicia, conclui com evidência |
| **Gestão** | Visão consolidada, indicadores, relatórios. Também é quem cadastra RTs |

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev
```

`.env.local` nunca vai pro git. O que cada variável faz está comentado no
`.env.example` — as do Supabase são obrigatórias; sem o token do TomTicket o app
sobe normalmente, só a integração fica indisponível.

## Estrutura

```
app/            Rotas (App Router), agrupadas por persona
  (gerente)/    Dashboard, montar/confirmar rota, validação, pendências
  (tecnico)/    Serviços do dia e execução em campo
  (gestao)/     Painel consolidado e relatórios
  chamados/     Compartilhada gerente+gestão
  api/          Route handlers (sugestão de rota, sync do TomTicket)

lib/            Lógica de negócio, sem UI
  routing/      Pontuação e escolha de RT — decide a OPERAÇÃO
  maps/google/  Integração Google Maps — fornece a GEOGRAFIA
  tomticket/    Cliente da API v2.0, coleta e mensagens
  relatorio/    Blocos do relatório (HTML e PDF)
  supabase/     Clientes de browser, servidor e middleware
  ui/           Componentes compartilhados

supabase/migrations/   Schema, numerado e sequencial
scripts/               Utilitários de linha de comando
docs/                  Plano de fases, guias e material de referência
public/                Assets servidos
```

`routing/` e `maps/` são separados de propósito: o Google diz distância e tempo,
mas quem escolhe qual RT visitar é o nosso algoritmo.

## Banco de dados

Migrations rodam no SQL Editor do Supabase, **em ordem numérica**. Uma vez
aplicada, uma migration nunca é editada — corrija criando a próxima.

Toda tabela tem RLS habilitado, e a policy nasce na mesma migration que cria a
tabela. Permissão é sempre garantida na RLS, nunca só escondendo o botão na
interface.

## Scripts

```bash
npm run dev            # desenvolvimento
npm run build          # build de produção (roda sempre que mexer em "use server")
npm run lint

node scripts/diagnostico-tomticket.mjs      # confere o token e o casamento RT (só leitura)
node scripts/verificar-telas.mjs            # abre as telas num navegador e reporta erros
node scripts/reset-dados-operacionais.mjs   # zera dados de teste (sem --confirmar, só simula)
node scripts/seed-test-users.mjs            # cria os usuários de teste
```

## Documentação

- [`docs/plano-de-fases.md`](docs/plano-de-fases.md) — o plano completo, fase a fase
- [`docs/atualizacoes-futuras.md`](docs/atualizacoes-futuras.md) — ideias registradas, ainda não implementadas
- [`docs/guia-skills-design.md`](docs/guia-skills-design.md) — quando usar cada skill de design
- [`docs/referencias/`](docs/referencias/) — material de origem (timbrado, marca, códigos de referência)
- `CLAUDE.md` — contexto e regras do projeto para assistentes de código

## Sincronização com o TomTicket

Os chamados chegam sozinhos, a cada 5 minutos, pela API v2.0 — o agendador vive
em `instrumentation.ts` e roda dentro do processo do servidor, sem depender de
ninguém estar logado. Em serverless (Vercel ou Netlify) ninguém mantém um
processo vivo entre requisições, então quem assume é um agendador externo
batendo em `POST /api/tomticket/sync` com o header `x-sync-secret`: o cron do
`vercel.json` na Vercel, ou o workflow
`.github/workflows/tomticket-sync.yml` (GitHub Actions) em qualquer outro
host, Netlify incluído.

## Deploy

### Netlify

Next.js 16 é auto-detectado pelo adaptador oficial da Netlify — não precisa
declarar o plugin no `netlify.toml` (a própria Netlify recomenda não fixar a
versão dele; atualiza sozinha a cada build).

1. No painel da Netlify: **Add new site → Import an existing project**,
   escolha o repositório (`Omateuso/CSM--ROUTE` no GitHub, ou o Gitea).
2. Build command `npm run build` e Node 20 já vêm do `netlify.toml`.
3. Em **Site settings → Environment variables**, preencha as mesmas
   variáveis do `.env.example` (Supabase, TomTicket, provedor de rotas).
4. Depois do primeiro deploy, configure a sincronização automática — a
   Netlify não tem cron nativo pra rotas do Next: em **Settings → Secrets
   and variables → Actions** deste repositório no GitHub, crie
   `SYNC_URL` (a URL do site publicado) e `SYNC_SECRET` (o mesmo valor
   configurado no site) — o workflow já commitado assume daí, rodando a
   cada 5 minutos.

### Vercel

`vercel.json` já traz o cron de sincronização pronto — importe o repositório
normalmente e preencha as mesmas variáveis de ambiente do `.env.example`.

Sincronizar traz **chamado**, não cria **rota**: quem gera serviço para o
técnico é a confirmação de uma rota pelo gerente.
