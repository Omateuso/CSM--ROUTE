# Design system — Gestão Operacional de Manutenção

Estabelecido na primeira tela real do sistema (Cadastro de Zonas/Regiões,
Fase 1 / Parte B). Reaproveitar em toda tela nova — não reinventar por página.

## Direção e sensação

**"Operacional claro" — identidade "Azulejo" (18/09/2026).** Ferramenta de
trabalho interna, densa, usada todo dia: fundo claro contínuo, menu lateral
na mesma cor do fundo (separado só por borda fina), UMA cor de destaque, e
as cores operacionais (prioridade/SLA) sendo as únicas coisas que "gritam"
na tela. Vocabulário do domínio: a placa de número da casa (RT) e a rota
como linha de paradas. Prévia aprovada pelo usuário (opção A entre 3):
https://claude.ai/artifact/JmHYEUtpE6NP3KQ4aJkbEr — substitui a moldura
escura + teal/azul/rosa competindo que existia antes.

**Login** continua deliberadamente divergente (versão escura, preto +
laranja, decisão de 24/08/2026) — só herda a tipografia.

## Tokens (`app/globals.css`)

- **Base neutra quente** (stone): `--background: #F7F6F3`, `--surface:
  #FFFFFF`, `--surface-input: #F1EFEA` (campo é "rebaixado", mais escuro
  que a superfície), `--surface-hover: rgba(28,25,23,.04)`.
- **Texto — 3 níveis usáveis** (≥ AA 4.5:1 sobre `--background`):
  `--text-primary: #1C1917`, `--text-secondary: #57534E`,
  `--text-tertiary: #6B665F`. `--text-muted: #A8A29E` **não passa AA —
  nunca em texto que precisa ser lido.**
- **Um único destaque**: `--accent: #0B6E68` (o teal `#008A83` do ícone
  PWA/login escurecido pra 5.8:1 com texto branco), hover `#095B56`,
  `--accent-tint: #E3F1EF` (item ativo do menu, chip selecionado),
  `--accent-tint-strong: #C6E3E0`, `--accent-on-tint: #0A5C57` (texto em
  cima da tinta). O azul-marinho `#1E3A6E` e o rosa `#FF0F7B`/`#FF135A`
  foram aposentados — não reintroduzir.
- **Feedback de UI**: `--danger: #B42318` (+`-tint`), `--success: #15803D`
  (+`-tint`; selo de localização OK e botões do técnico), `--info: #1D4ED8`
  (+`-tint`; "planejado/informação").
- **Cores operacionais** (só badges de prioridade/SLA): emergencial
  `#B42318`, alta `#B4400B`, normal `#946200`; SLA dentro `#15803D`,
  próximo `#946200`, vencido `#6D28D9`. Cada uma tem `-tint` pro fundo da
  pílula. Nunca como destaque genérico.
- **Bordas**: `--border: rgba(28,25,23,.08)` (divisor), `--border-strong:
  rgba(28,25,23,.16)` (campo, botão secundário, placa).
- **Radius**: `--radius-sm: 8px` (campo/botão), `--radius-md: 12px`
  (card), `--radius-lg: 16px` (diálogo). Concêntrico: card 12 + padding 4
  → filho 8.
- **Sombras** (`shadow-lift`, `shadow-lift-hover`, `shadow-lift-overlay`):
  anel de 1px + duas sombras suaves. Ver "Depth".
- **Movimento**: `--ease-out: cubic-bezier(.23,1,.32,1)`; durações
  120–180ms; só `transform`/`opacity`/cor, nunca `transition-all`;
  `active:scale-[.97]` em todo botão; `prefers-reduced-motion` respeitado.
- **Fontes**: IBM Plex Sans (`--font-sans`, corpo/UI, pesos 400–700) + IBM
  Plex Mono (`--font-mono`, só dado estrutural: placa da RT, protocolo,
  horário — nunca corpo de texto nem rótulo). Trocadas da Geist em
  18/09/2026 (`app/layout.tsx`).

## Tema claro / escuro

Dois blocos de tokens em `app/globals.css`: o `:root` (claro) e o escuro,
aplicado por `:root[data-theme="dark"]` ou por `prefers-color-scheme: dark`
quando não há `data-theme="light"`. Um matiz só (stone quente); no escuro
muda a luminosidade (`#161514` → `#201F1D` → `#2A2826`), operacionais
dessaturadas e clareadas com fundo em alpha, sombras viram anel. A
preferência vai no cookie `tema` (lido em `app/layout.tsx` → `data-theme`
no `<html>`, sem flash); o alternador é `lib/ui/theme-toggle.tsx`
(automático → claro → escuro). **Regras:** nunca `text-white` em cima de
fundo colorido — usar `text-on-accent` (`--on-accent`: branco no claro,
quase-preto no escuro); nunca `neutral-*`/`zinc-*`/hex solto — só tokens;
imagem/mapa recebem tratamento próprio (Leaflet: popup nos tokens, tiles
com filtro no escuro).

## Interatividade — o que todo KPI e lista deve ter

- **KPI é link** quando existe uma tela/filtro que explica o número:
  `StatCard href/dica`, `LinhaDeRota` com `href` por parada, tiles do
  "Atenção agora". O card inteiro é o alvo; seta à direita, sobe no hover
  (`CARD_INTERACTIVE`), `title` + texto `sr-only` dizendo aonde vai.
- **Filtros por URL** em `/chamados` (`?busca=&prioridade=&sla=&regiao=`):
  todo link "ver chamados X" aponta pra lá, nunca pra lista sem filtro.
- **Busca rápida** (Ctrl+K): páginas, RTs, protocolo, texto livre.
- **Feedback:** `active:scale-[.97]` em botão; hover em linha de tabela e
  card clicável; `IndicadorAoVivo` ("Atualizado", ponto pulsando) em tela com Realtime.

## Depth — UMA estratégia: sombra discreta pra card, borda pra campo

Card/superfície que "sobe" usa `CARD` (`bg-surface shadow-lift`), nunca
`border border-border` — a borda hairline fica só pra divisor de linha
(`divide-border`) e pra campo/botão secundário (`border-strong`). Card
clicável: `CARD_INTERACTIVE` (sobe pra `shadow-lift-hover` no hover).
Diálogo: `shadow-lift-overlay` + backdrop escurecido/desfocado + entrada de
180ms a partir de `scale(.96)`. Menu lateral: sem sombra, só a borda.

## Hierarquia e densidade

- Escala tipográfica (~1.25 sobre 13.5/14px): apoio 12 · corpo 13.5–14 ·
  título de seção 15/600 · título de diálogo 18/600 · título de página
  24–26/600 · número de card 24–28/600 · número herói 40–56/600. Títulos
  com `tracking -0.015em a -0.03em`; nunca caixa alta em título/rótulo
  (o "VISÃO GERAL"/"VALIDAÇÃO" em caixa alta saiu em 18/09).
- Peso e cor fazem mais hierarquia que tamanho: num mesmo 13.5px, valor
  600/primary · rótulo 500/secondary · meta 400/tertiary.
- Densidade: padding de card `p-5` (20px), gap entre cards `gap-4`,
  linha de tabela `py-2.5`, item de menu 36px (44px no celular), botão
  36px, botão do técnico 52px.
- Um foco por tela: o número que exige decisão lidera (Atenção agora no
  Dashboard); o resto é demovido de propósito.
- Página: `mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10`.

## Spacing

Grid de 4px (escala padrão do Tailwind). Padding de card: `p-5` (20px).
Gap entre cards: `gap-4` (16px). Linhas de lista: `py-2` (8px vertical).

## Componentes-padrão

- **Botão de ação em texto** (Renomear/Excluir/Cancelar/+Adicionar): `text-xs
  font-medium`, cor `text-tertiary` (neutro) ou `text-accent`
  (ação positiva/"+"), hover mais escuro. Sempre com `FOCUS_RING` e
  `TAP_TARGET`, importados de `lib/ui/styles.ts` (extraído aqui porque já
  é a 2ª tela reaproveitando — zonas e RTs importam do mesmo lugar).
- **Botões** — sempre importar de `lib/ui/styles.ts`, nunca montar a
  string na tela: `PRIMARY_BUTTON` (teal sólido, 1 por contexto),
  `SECONDARY_BUTTON` (branco com borda), `DANGER_BUTTON`, `GHOST_BUTTON`
  (texto no destaque, sem moldura), `ICON_BUTTON` (36×36). Todos 36px,
  13.5/600, raio 8, `active:scale-[.97]`, anel de foco. App do técnico:
  `PRIMARY_ACTION_BUTTON` (verde, 52px, largura total) e
  `SECONDARY_ACTION_BUTTON`.
- **Placa da RT** (`PlacaRt` em `lib/ui/placa-rt.tsx`, classe `PLACA_RT`):
  assinatura do produto — código da RT em mono 11.5/600, tracking .04em,
  moldura `border-strong` sobre `surface-input`, raio 5, altura 22. Usar
  SEMPRE que um código de RT aparecer; ao lado dela, o nome vai sem o
  código repetido (`nomeSemCodigo`).
- **Badge de prioridade/SLA**: pílula 22px com fundo `-tint` + ponto +
  texto na cor escura da escala (`StatusDot` com `pillClassName`). Os
  outros status (serviço, chamado, rota, RT) continuam "dot + texto",
  mais quietos — são duas camadas de barulho de propósito.
- **Card de indicador** (`StatCard`/`OperacaoHojeCard`): rótulo 12/500
  secondary em cima, número 24–40/600 embaixo, sem borda lateral colorida
  (a cor só aparece quando informa: `tom="emergencial"|"vencido"`).
- **Input de texto** (`FIELD_INPUT`): `border-border-strong
  bg-surface-input rounded-[var(--radius-sm)] px-3 py-2 text-sm`, foco =
  `border-accent` + `ring-2 ring-accent/25`.
  **Sempre** com `<label>` associada (pode ser `sr-only` em formulários
  inline compactos) — nunca só `placeholder`.
- **Badge de contagem**: `border-border-strong rounded-sm px-1.5 py-0.5
  font-mono text-[11px] tabular-nums text-tertiary`.
- **Substituição de conteúdo por estado** (não inline-squeeze): ações como
  "editando" e "confirmando exclusão" substituem o conteúdo inteiro do
  cabeçalho/linha (não tentam conviver espremidas ao lado do título) — mais
  prático e previsível em qualquer largura do que depender de `flex-wrap`
  aninhado.
- **Tabela densa** (dataset pequeno, ex.: RTs — 98 linhas, filtra no
  client): `<table>` com `<th scope="col">`, linhas em `divide-y
  divide-border`, primeira coluna (código/id) em `font-mono text-xs
  tabular-nums`, coluna principal com texto primário + linha secundária
  `text-tertiary` embaixo (em vez de mais colunas). Envolver em `<div
  className="overflow-x-auto">` **com a própria `<table>` levando
  `min-w-[Npx]`** — sem o min-width a tabela só espreme/corta colunas em
  mobile em vez de habilitar o scroll horizontal.
- **Diálogo de formulário maior** (4+ campos — não cabe inline): usar
  `<Modal>` de `lib/ui/modal.tsx` (casco compartilhado — não hand-roll de
  novo por tela). Ele resolve as 3 coisas que o `<dialog>` nativo não dá
  de graça: `aria-labelledby` pro `<h2>` do título; fechar no clique do
  backdrop (`event.target === dialogRef.current`); e **centralização
  explícita** (`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
  m-0`) — o Tailwind Preflight zera `margin`, quebrando o `margin: auto`
  nativo do `dialog:modal` e grudando o modal no canto superior esquerdo.
  Focus trap e retorno de foco já vêm de graça do `<dialog>` nativo.
  O componente pai remonta o diálogo a cada abertura via `key` incremental
  — `defaultValue`/`useActionState` só aplicam o valor inicial na
  montagem, então reabrir sem remontar (pra editar um registro diferente,
  ou reabrir "criar" depois de já ter criado um) mantém campos/erro da
  abertura anterior. Usar `useCloseOnSuccess` de `lib/ui/use-close-on-success.ts`
  pra fechar sozinho quando a submissão terminar sem erro.
- **IDs de campo únicos por instância**: como os diálogos de uma tela
  costumam ficar todos montados ao mesmo tempo no DOM (só alternam
  open/close, não montam/desmontam), **nunca usar `id` fixo** em campo de
  formulário dentro de diálogo (`id="nome"` colide se dois diálogos
  tiverem campo "nome"). Usar `useId()` no componente e compor
  (`` `${uid}-nome` ``) — barato, e evita quebrar a associação de
  `<label>` (idêntico ao problema de IDs duplicados em HTML puro).
- **Uma operação sensível = uma função Postgres dedicada, nunca vários
  fluxos de UI escrevendo na mesma coluna por caminhos diferentes**: RTs
  tem 3 diálogos (criar / editar dados básicos / trocar endereço) porque
  cada um mapeia pra uma operação de banco com contrato próprio (ver
  CLAUDE.md, "Endereço de RT tem histórico"). Ao criar uma função RPC
  nova, **o cache de schema do PostgREST não pega automaticamente** —
  depois de rodar a migration no SQL Editor, rode também `NOTIFY pgrst,
  'reload schema';` (ou, se mesmo assim der `PGRST202`, é sinal de que a
  função não foi criada de fato — confira com `select proname from
  pg_proc where proname = '...'` antes de assumir que é só cache).
- **Status ativo/inativo**: neutro, não usa verde (reservado pro
  vocabulário de SLA). Ativo = ponto+texto discreto em `text-tertiary`,
  sem badge. Inativo = badge com borda (`border-border-strong` +
  `bg-surface-input`) em `text-secondary` — o estado raro/exceção ganha
  mais peso visual que o comum.

## Acessibilidade — padrões obrigatórios

- Todo input de formulário tem `<label>` (mesmo que `sr-only`).
- Todo botão/link tem `FOCUS_RING` (anel accent consistente — não confiar
  no outline default do navegador, que é fino/pouco visível).
- Botões de texto pequenos (`text-xs`) usam `TAP_TARGET` (`py-1.5 -my-1.5`)
  pra alvo de toque ≥ 24px (WCAG 2.2 AA 2.5.8) sem alterar o espaçamento
  visual entre linhas.
- Quando a mesma ação (ex.: "Renomear") se repete várias vezes na tela
  (uma por linha), usar `aria-label` com o nome do item
  (`Renomear região ${nome}`) — mantém "Renomear" como prefixo visível
  (WCAG 2.5.3 Label in Name) mas desambigua pra leitor de tela.
- Mensagens de erro dinâmicas (ex.: violação de FK) usam `role="alert"`.
- Tecla Escape fecha formulários inline (paridade com "Cancelar").
- Tabelas: `<th scope="col">` em todo cabeçalho de coluna (WCAG 1.3.1).
- Ação repetida em várias linhas de uma tabela (Editar/Ativar/Desativar por
  linha): mesmo tratamento do "Renomear" acima — `aria-label` com o
  identificador da linha (`Editar RT ${codigo}`).

## Navegação (`app/app-nav.tsx`)

Menu lateral 248px (68px recolhido), mesma cor do fundo, borda direita
fina. Links agrupados por momento do fluxo (`NAV_GRUPOS`): Operação /
Fechamento / Relatórios / Cadastros (gerente); Acompanhamento / Cadastros
(gestão). Item 36px, 13.5/500; ativo = `accent-tint` + texto `on-tint` +
ícone `accent` + `aria-current="page"`. Celular (≤860px): barra de 56px no
topo, painel desce POR CIMA do conteúdo e **nasce fechado** (estado
próprio, independente do cookie do desktop), fecha ao escolher link.

## Pendências conhecidas (não bloqueiam, revisitar se acumular)

- Rodadas 1 e 2 da identidade (18/09) cobriram tokens, casca,
  componentes compartilhados, placa da RT em toda tela, tags e a linha de
  rota. Ainda fora: Login (escuro de propósito), `OperacaoHojeCard` em
  Validação/Painel (poderia virar `LinhaDeRota` também), e os formulários
  maiores (registrar urgência, confirmar rota) que só herdaram tokens.
- **Linha de rota** (`LinhaDeRota`, `lib/ui/linha-de-rota.tsx`): paradas
  36px (26px compacto) ligadas por linha de 2px `border-strong`; tom por
  parada (info/accent/atencao/sucesso), `cheio` = concluída, `atual` =
  anel `accent/20`. Um `<ol>` com `aria-label`; nunca mais de 8 paradas.
- Botões de texto (Renomear/Excluir) em estado de repouso têm sinalização
  de clicabilidade relativamente sutil (cor neutra, sem sublinhado). Aceito
  por ora — é um padrão comum em ferramentas densas — mas se usuários
  reais tiverem dificuldade, considerar reforçar (sublinhado no hover já
  existe; poderia virar hover+underline).
