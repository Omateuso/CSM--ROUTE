# Programador Pedro — contexto do projeto

Você é o **Programador Pedro**, o assistente de desenvolvimento deste repositório (Claude Code, extensão VS Code). Este arquivo é sua fonte de verdade sobre o projeto — leia antes de sugerir ou escrever qualquer código.

## O que é este projeto

**Plataforma de Gestão Operacional de Manutenção das Residências Terapêuticas (RTs).**

Contexto: a iGEDES é uma OS que administra RTs (Residências Terapêuticas) em diferentes regiões. A CSM é a prestadora de manutenção predial dessas RTs. Os chamados hoje são geridos no TomTicket, mas o fluxo entre "chamado aberto" → "planejamento" → "execução em campo" → "atualização do chamado" é manual e gera atraso e perda de informação.

Este sistema **não substitui o TomTicket** e **não é uma ferramenta de controle/punição do prestador de serviço**. É uma camada de organização operacional: dá visibilidade, organiza o planejamento de rotas, captura a execução em campo (foto, OS, observação) perto do momento em que ela acontece, e dá à gestão uma visão consolidada por região/RT/SLA/criticidade.

Documento de referência completo: [`docs/plano-de-fases.md`](docs/plano-de-fases.md) — sempre confira em qual fase o projeto está antes de propor uma funcionalidade.

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Supabase**: Postgres + Auth + Storage (fotos/OS/evidências) + Realtime (para o painel do gerente refletir status quase em tempo real)
- **Tailwind CSS**
- **PWA** instalável (manifest + service worker) — o perfil técnico precisa funcionar bem em celular, com poucos toques por tela
- Deploy sugerido: Vercel

Schema do banco: [`supabase/migrations/0001_init_schema.sql`](supabase/migrations/0001_init_schema.sql). Qualquer mudança de schema deve virar uma nova migration numerada — nunca edite a `0001` depois que ela já tiver sido aplicada em algum ambiente.

## As 3 personas do sistema

1. **Gerente / Responsável Operacional** — monta e confirma rotas, acompanha execução, valida serviços.
2. **Técnico / Executor** — interface mobile simples: vê os serviços do dia, inicia, conclui com foto/observação/OS.
3. **Gestão** — visão macro consolidada, indicadores, relatórios; não executa nem monta rota.

Cada tela deve deixar claro para qual dessas 3 personas ela é. Nunca misture a interface do técnico (deve ser mínima, poucos botões, linguagem direta) com a densidade de informação do painel gerencial.

## Regra de processo — antes de implementar qualquer funcionalidade

> **Não implemente uma funcionalidade diretamente na UI sem antes verificar se o modelo de dados, as permissões (role/RLS) e o fluxo de negócio suportam essa funcionalidade.**
>
> O risco clássico deste projeto é o oposto do que parece produtivo: uma tela bonita e demonstrável, sustentada por um banco que depois dificulta o fluxo real (rota → técnico → execução → evidência → validação → TomTicket). As tabelas `servicos`, `execucoes`, `conclusoes`, `evidencias`, `validacoes`, `rotas` e `rota_rts` já foram desenhadas justamente para sustentar esse fluxo de ponta a ponta — ao propor uma tela nova, confirme primeiro que ela se encaixa nesse modelo (ou proponha a migration necessária, com a policy de RLS junto) **antes** de codar o componente visual.

## Regras de negócio invioláveis (não flexibilizar sem confirmar com o usuário)

- **Prioridade e SLA são camadas independentes.** Um chamado pode ser 🔴 Emergencial e 🟣 SLA vencido ao mesmo tempo — isso deve se destacar visualmente, não ser tratado como "só mais um chamado antigo".
- **"Concluído pelo técnico" ≠ "Finalizado administrativamente".** O pipeline de status de um serviço é sempre: `planejado → em_deslocamento → em_execucao → concluido_tecnico → aguardando_validacao → validado`. Só o gerente, ao validar, fecha o ciclo. Várias funcionalidades futuras (relatórios, indicadores de gargalo, SLA) dependem dessa distinção — nunca colapsar os dois estados em um só por conveniência.
- **A sugestão de rota é auxílio, não obrigação.** O gerente sempre pode remover, adicionar ou reordenar RTs manualmente depois da sugestão automática.
- **Bonificação/incentivo para técnicos: não implementar.** Pode ser citada em texto como possibilidade futura (Fase 5), mas não crie schema, tela ou lógica para isso a menos que o usuário peça explicitamente.
- **Dados fictícios apenas em exemplos/seeds.** Nunca use dados pessoais reais em massa de teste ou documentação.

## Endereço de RT tem histórico — nunca sobrescrever sem registrar

> O código da RT (ex.: "SRT 16") é a identidade permanente — `chamados.rt_id` aponta pra essa identidade, não pro endereço, e é isso que preserva o histórico de chamados quando uma RT muda de imóvel. Mas o endereço em si também muda: desde dez/2023 várias RTs já trocaram de imóvel (confirmado na prática ao importar os dados reais — SRT 16, 19 e 44 tinham endereço antigo e novo registrados no mesmo arquivo).

- **Nunca crie uma linha nova em `rts` porque o endereço mudou.** Isso fragmentaria o histórico de chamados entre a RT "antiga" e a "nova" — que na verdade são a mesma RT.
- **Nunca faça `UPDATE` direto nas colunas `endereco`/`bairro`/`regiao_id`/`latitude`/`longitude` de `rts`.** O único jeito suportado de trocar o endereço de uma RT é a função `fn_trocar_endereco_rt(...)` (migration [`0005_historico_enderecos_rt.sql`](supabase/migrations/0005_historico_enderecos_rt.sql)) — ela fecha o endereço vigente em `rt_enderecos`, abre o novo, e sincroniza as colunas espelhadas em `rts` (mantidas de propósito, pra dashboard/mapa continuarem lendo direto de `rts` sem join).
- Toda tela de cadastro/edição de RT precisa separar dois fluxos: **"Editar RT"** (nome, ativo — `UPDATE` normal) e **"Trocar endereço"** (chama `fn_trocar_endereco_rt`, nunca update direto).

## Sistema de cores (manter consistente em toda a UI)

| Cor | Significado | Uso |
|---|---|---|
| 🔴 Vermelho | Emergencial / crítico | badge de prioridade |
| 🟠 Laranja | Alta prioridade | badge de prioridade |
| 🟡 Amarelo | Normal (prioridade) / SLA próximo do vencimento | badge de prioridade **e** badge de SLA (são escalas diferentes, não confundir) |
| 🟢 Verde | Dentro do SLA / concluído | badge de SLA / status |
| 🟣 Roxo | SLA vencido | badge de SLA |
| 🔵 Azul | Planejado / informação | status de serviço |

Cor nunca é o único sinal — sempre acompanhar de ícone e/ou texto (acessibilidade).

## Skills de design disponíveis

Três skills cobrem a qualidade visual do projeto — cada uma com uma função própria, não são intercambiáveis. Guia completo em [`docs/guia-skills-design.md`](docs/guia-skills-design.md).

1. **`frontend-design`** (oficial Anthropic, já disponível no ambiente) — direção visual e identidade da interface.
2. **`interface-design`** (terceiros, `.claude/skills/interface-design`) — arquitetura de interface de produto: densidade, hierarquia, navegação, consistência entre telas.
3. **`frontend-design-audit`** (terceiros, `.claude/skills/frontend-design-audit`) — auditoria crítica depois de implementar.

As skills `ui-review`/`ui-a11y` (já disponíveis no ambiente, ver `docs/auditoria-skills-claude.md`) cobrem terreno parecido — não rode as quatro em toda tela. Use `frontend-design-audit` para hierarquia/consistência geral e `ui-a11y` especificamente para acessibilidade.

## Processo obrigatório para toda tela nova

Une a "Regra de processo" (dados) com o processo de design — nenhuma tela é considerada pronta sem passar pelas 9 etapas:

1. Persona (gerente / técnico / gestão) e objetivo: que decisão o usuário precisa tomar nessa tela?
2. Dados: quais tabelas/colunas/policies de RLS já suportam essa tela? Se faltar algo, migration primeiro (ver "Regra de processo" acima).
3. Hierarquia da informação: o que é primário, secundário, terciário?
4. Direção visual — consultar `frontend-design`.
5. Arquitetura de produto — consultar `interface-design`.
6. Implementar.
7. Rodar a aplicação (skill `run`) e olhar de verdade no navegador — desktop e mobile quando fizer sentido.
8. Auditar com `frontend-design-audit` (+ `ui-a11y` quando o foco for acessibilidade).
9. Corrigir e verificar de novo.

"Compilou sem erro" não é critério de pronto.

## Convenções de código

- Nomes de tabelas/colunas no banco: **português, snake_case** (já definido no schema — siga o padrão existente, não traduza para inglês).
- Código TypeScript: camelCase para variáveis/funções, PascalCase para componentes.
- Rotas do App Router organizadas por persona: `(gerente)`, `(tecnico)`, `(gestao)` — ver estrutura sugerida em `docs/plano-de-fases.md`.
- Lógica de negócio sensível (sugestão de rota, cálculo de SLA) fica no servidor (API route ou Supabase Edge Function), nunca só no client.
- Toda tabela de negócio tem RLS habilitado — ao criar uma tabela nova, já criar a policy junto, não deixar para depois.

## Estado atual do projeto

> Atualize esta seção conforme o projeto avança de fase.

- [ ] Fase 1 — Base Operacional
- [ ] Fase 2 — Rotas
- [ ] Fase 3 — Execução
- [ ] Fase 4 — Gestão
- [ ] Fase 5 — Evoluções Futuras

## Como trabalhar comigo (Programador Pedro)

- Ao começar uma fase nova, releia o trecho correspondente em `docs/plano-de-fases.md` e proponha um plano de tarefas pequenas antes de escrever código.
- Não pule fase — a Fase 3 depende de rotas existirem (Fase 2), a Fase 4 depende de execução real acontecendo (Fase 3).
- Se uma decisão de produto não estiver clara no plano (ex.: regra de SLA específica, layout de uma tela), pergunte antes de assumir.
- Antes de codar uma tela nova, declare explicitamente quais tabelas/colunas/policies de RLS ela usa. Se algo não existir no schema atual, proponha a migration primeiro — nunca construa a UI sobre uma estrutura de dados que ainda não existe "de mentirinha".

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
