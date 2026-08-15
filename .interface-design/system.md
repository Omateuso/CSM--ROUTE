# Design system — Gestão Operacional de Manutenção

Estabelecido na primeira tela real do sistema (Cadastro de Zonas/Regiões,
Fase 1 / Parte B). Reaproveitar em toda tela nova — não reinventar por página.

## Direção e sensação

"Registro/cadastro territorial" — vocabulário e composição inspirados em
planta baixa / cadastro civil (o próprio domínio: manutenção predial,
zoneamento). Neutro e restrito, não maximalista. Prioriza clareza
operacional sobre impacto visual (o público é interno, denso, recorrente).

## Tokens (`app/globals.css`)

- **Base neutra quente** (stone, não zinc/gray frio): `--background:
  #faf9f7`, `--surface: #ffffff`, `--surface-input: #f5f4f2`.
- **Texto — 3 níveis usáveis** (todos ≥ WCAG AA 4.5:1 sobre `--background`):
  `--text-primary: #1c1917`, `--text-secondary: #57534e`,
  `--text-tertiary: #6b6560` (~5.3:1). `--text-muted: #a8a29e` existe mas
  **não passa AA (~2.2:1) — nunca usar em texto que precisa ser lido**, só
  em contexto puramente decorativo (hoje, nenhum uso real).
- **Um único accent**: `--accent: #1e3a6e` (azul "planta baixa"), hover
  `--accent-hover: #16305a`. Não usar as cores operacionais
  (vermelho/laranja/amarelo/verde/roxo do CLAUDE.md) fora dos badges de
  prioridade/SLA — são um vocabulário à parte, reservado.
- **Danger**: `--danger: #b91c1c`, hover `--danger-hover: #991b1b`.
- **Bordas**: `--border: rgba(28,25,23,.08)`, `--border-strong:
  rgba(28,25,23,.16)` — hairline intencional (ver Depth abaixo).
- **Radius**: `--radius-sm: 6px` (inputs/botões), `--radius-md: 10px`
  (cards), `--radius-lg: 14px` (reservado pra modais, ainda sem uso).
- Fontes: Geist Sans (`--font-sans`, corpo/UI) + Geist Mono (`--font-mono`,
  só pra dado tabular/estrutural — contagens, códigos — nunca corpo de
  texto).

## Depth — bordas finas, sem sombra

Escolha única e deliberada: hairline borders (`--border`/`--border-strong`)
para separar cards/linhas, nunca `box-shadow` decorativo. Combina com o
tom "documento/registro" e evita o visual genérico de dashboard de IA.
Consequência aceita conscientemente: bordas nesse nível de opacidade
provavelmente não atingem 3:1 de contraste não-textual (WCAG 1.4.11) —
mitigado nos inputs por eles também terem `--surface-input` distinto do
fundo (duas pistas redundantes, não só a borda).

## Spacing

Grid de 4px (escala padrão do Tailwind). Padding de card: `p-5` (20px).
Gap entre cards: `gap-4` (16px). Linhas de lista: `py-2` (8px vertical).

## Componentes-padrão

- **Botão de ação em texto** (Renomear/Excluir/Cancelar/+Adicionar): `text-xs
  font-medium`, cor `text-tertiary` (neutro) ou `text-accent`
  (ação positiva/"+"), hover mais escuro. Sempre com `FOCUS_RING` e
  `TAP_TARGET`, importados de `lib/ui/styles.ts` (extraído aqui porque já
  é a 2ª tela reaproveitando — zonas e RTs importam do mesmo lugar).
- **Botão primário** (submit de form pequeno): `bg-accent text-white
  rounded-sm px-3 py-1.5 text-xs font-medium`.
- **Input de texto inline**: `border-border bg-surface-input rounded-sm
  px-2.5 py-1.5 text-sm`, foco = `border-accent` + `ring-1 ring-accent`.
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
- **Diálogo de formulário maior** (4+ campos — não cabe inline): `<dialog>`
  nativo via `showModal()`/`close()` (focus trap e retorno de foco de
  graça, confirmado empiricamente). Precisa de 3 coisas manuais que o
  navegador não dá sozinho: (1) `aria-labelledby` apontando pro `<h2>` do
  título; (2) fechar no clique do backdrop, comparando `event.target ===
  dialogRef.current` no `onClick` do próprio `<dialog>`; (3)
  **centralização explícita** (`fixed top-1/2 left-1/2 -translate-x-1/2
  -translate-y-1/2 m-0`) — o Tailwind Preflight zera `margin`, o que
  quebra a centralização nativa via `margin: auto` do `dialog:modal` e
  gruda o modal no canto superior esquerdo. Formulário maior (7+ campos)
  fica remontado a cada abertura via `key` incremental no componente pai
  — `defaultValue`/`useActionState` só aplicam o valor inicial na
  montagem, então reabrir o mesmo `<dialog>` (sem remontar) pra editar um
  registro diferente mantém os campos/erro da abertura anterior.
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

## Pendências conhecidas (não bloqueiam, revisitar se acumular)

- Sem sistema de navegação/nav global ainda — cada tela por enquanto tem
  seu próprio link de volta. Decidir isso quando o dashboard (próxima
  tela com nav real) for implementado.
- Botões de texto (Renomear/Excluir) em estado de repouso têm sinalização
  de clicabilidade relativamente sutil (cor neutra, sem sublinhado). Aceito
  por ora — é um padrão comum em ferramentas densas — mas se usuários
  reais tiverem dificuldade, considerar reforçar (sublinhado no hover já
  existe; poderia virar hover+underline).
