# Atualizações futuras

> **Programador Pedro:** este arquivo é um repositório de ideias/funcionalidades futuras que o Pedro Henrique (usuário) vai escrevendo aqui ao longo do tempo — coisas que ele já sabe que quer, mas que **não precisam ser implementadas agora**. Não é uma fase do `docs/plano-de-fases.md`, não é uma tarefa da sprint atual, é um estacionamento de ideias pra não se perder.

## O que fazer com este arquivo

- No começo de cada sessão nova (ou sempre que o usuário mencionar "atualizações futuras"), releia este arquivo inteiro e identifique o que é novo desde a última vez que você leu — itens novos aparecem no topo da seção "Ideias registradas" abaixo, com data.
- **Não implemente nada que estiver aqui só por estar aqui.** Um item só vira trabalho de verdade quando o usuário pedir explicitamente pra colocar em uma fase (`plano-de-fases.md`) ou pedir pra começar agora. Até lá, é só contexto pra você ter em mente ao tomar decisões de arquitetura — ex.: se um item futuro sugere que uma tabela vai precisar de uma coluna a mais, pode valer a pena já deixar espaço pra isso no desenho de uma migration atual, mas sem criar a coluna/tela/lógica antes da hora.
- Quando um item daqui for efetivamente implementado (ou decidido que não vai ser feito), avise o usuário que ele pode marcar/apagar a entrada correspondente, ou mover ela pra o `plano-de-fases.md` como tarefa de uma fase — não apague nada por conta própria.
- Se um item novo aqui contradizer uma regra de negócio invioável do `CLAUDE.md` (seção "Regras de negócio invioláveis"), ou mudar uma decisão de arquitetura já tomada, pare e pergunte ao usuário antes de assumir qualquer coisa — não tente conciliar sozinho.
- Quando você (Programador Pedro) implementar uma tarefa que estava registrada aqui, não apague a entrada — edite o título ou o texto dela adicionando em destaque **TAREFA JÁ IMPLEMENTADA**, com uma linha curta dizendo onde/quando (ex.: arquivo, migration, data). Isso mantém o histórico de que a ideia existiu e foi resolvida, sem perder o registro.

## Ideias registradas

### Exportar relatório diário em PDF (2026-08-18)

Pedido do usuário ao terminar de testar a Fase 3: quando a tela de acompanhamento do dia existir (Fase 4 — "Painel do gerente"/"Painel da gestão"/"Relatório diário", já planejados em `docs/plano-de-fases.md`), ela deve ter uma opção de baixar esse relatório como **PDF**. Isso não está no `docs/plano-de-fases.md` hoje — nem na Fase 4 nem na Fase 5. Decisão do usuário (18/08/2026): não formalizar no plano agora, só registrar aqui; escopo exato (o que entra no PDF, layout) fica pra decidir quando a Fase 4 começar de verdade, com mais contexto na mão.

Não implementar nada disso agora — nem a tela de painel/relatório existe ainda.

### Botão "Abrir no TomTicket" — TAREFA PARCIALMENTE IMPLEMENTADA (2026-08-19)

**Implementado em 19/08/2026**, mas não do jeito originalmente imaginado aqui (achado real testando com o usuário): o TomTicket **não tem URL de abertura direta por protocolo** — a tela de detalhe do chamado usa um id interno (hash tipo `c202de4a...`) que a gente nunca teve e não tem como capturar sem integrar a API de verdade (isso sim continua Fase 5). O que dá pra fazer sem API: um link pra busca do TomTicket já filtrada pelo protocolo (`https://console.tomticket.com/dashboard/general-search?query={protocolo}`, padrão confirmado testando ao vivo com o usuário) — abre com o chamado como único resultado, falta só 1 clique a mais pra abrir de verdade. Implementado em `lib/tomticket.ts` (helper `tomticketSearchUrl`) + botão "Ir para o TomTicket →" na tela `(gerente)/validacao`, dentro da nova seção "Validados recentemente" (lista as ~20 últimas validações do gerente, mais recente primeiro — pedido do usuário no mesmo dia).

**Ainda não feito** (não pedido explicitamente ainda): o mesmo botão no modal de detalhes do chamado (`app/chamados/chamado-detalhe-dialog.tsx`), que era o local original imaginado aqui — reaproveitaria o mesmo helper `tomticketSearchUrl`, é barato de adicionar se o usuário quiser depois. Categoria/tipo de chamado da Busca Avançada continua não avaliado.

**Parcialmente coberto (10/09/2026):** o modal de detalhes do chamado ganhou um compositor de **resposta ao cliente no TomTicket** (item 8 dos "8 ajustes de uso real" — ver CLAUDE.md), com anexos, sem finalizar. Não é o link "Ir para o TomTicket" (esse continua não estando no modal de detalhes), é uma ação de escrita — mas resolve na prática a necessidade que motivou o pedido. O link de conferência segue disponível na tela de Validação/Pendências.

### Técnico registrar problema resolvido sem chamado existente (2026-08-16)

Cenário do usuário: o técnico, numa visita à RT, pode identificar um problema de manutenção que ainda não tem chamado nenhum aberto — e já resolver na hora. Hoje ele só teria como avisar o gerente informalmente (fora do sistema) pra alguém criar o chamado depois, retroativo.

Ideia: uma opção na tela do técnico (ainda não existe — é Fase 3, "Execução", que depende de rotas/Fase 2 existirem primeiro) pra ele registrar "encontrei e já resolvi isso, sem chamado prévio" — algum tipo de notificação/registro que chega ao gerente. Decisão do usuário: quando essa tela existir, essa função deve nascer **desabilitada**, do mesmo jeito que o "+ Novo chamado" do gerente está agora — só habilitar depois que a gestão validar o fluxo.

Não implementar nada disso agora — nem a tela do técnico existe ainda. Só um lembrete de design pra quando a Fase 3 chegar: essa função deve ter uma UI de "desabilitado, aguardando aprovação" pronta desde o início, não ser adicionada depois.

### RT com busca no formulário de chamados (2026-08-16)

Hoje o campo de RT no formulário de "Novo chamado"/"Editar chamado" (Fase 1, B3) é um `<select>` nativo agrupado por zona, com as 98 RTs cadastradas. Funciona, mas não tem busca por texto — pra achar uma RT específica é preciso rolar visualmente dentro do grupo da zona certa.

Identificado pelo Programador Pedro durante a auditoria de design da tela de chamados (achado real, não implementado de propósito). Decisão: não vale investir num combobox com busca agora, porque hoje o canal principal de entrada de chamados é o import diário da planilha do TomTicket — esse formulário manual é usado pouco. Reavaliar se o cadastro manual virar o canal principal (ex.: depois que a gerência aprovar o sistema e o import diário deixar de ser necessário).

Local: `app/chamados/chamado-create-dialog.tsx` e `chamado-edit-dialog.tsx` (a tela saiu de dentro de `(gerente)/` e passou a ser compartilhada — ver CLAUDE.md, "Permissões de cadastro").


### Puxar API do Tomticket para o sistema de rotas

Após a gestão aprovar o sistema de rotas para a CSM. Vou verificar se eles autorizção puxar a API do tomticket para assim que a gestão quiser criar um chamado pelo sistema de rotas, ser criado em ambos sistemas. 





## Ideia registrada — Raio de proximidade configurável na montagem de rota

**Data:** 16/08/2026

### TAREFA FUTURA — Raio de proximidade configurável

Atualmente, a Rota Inteligente deve utilizar **5 km como raio padrão de proximidade** para encontrar RTs candidatas próximas da última RT selecionada.

Esse valor deve permanecer centralizado na configuração do algoritmo para permitir evolução futura.

### Evolução desejada

Após a implantação do sistema, validação pela gestão e adaptação da CSM ao uso da ferramenta, avaliar a criação de um campo na tela **Montar Rota** para que o gerente possa escolher o raio utilizado na busca de RTs candidatas.

Exemplo de interface:

**Raio de proximidade**

`5 km ▾`

Opções possíveis:

* 3 km
* 5 km
* 8 km
* 10 km
* 15 km
* 20 km

O valor padrão deve continuar sendo **5 km**.

### Importante

O raio não deve representar uma distância máxima obrigatória da rota.

Ele deve funcionar como:

> **raio utilizado para encontrar e sugerir RTs candidatas próximas.**

O gerente deve continuar podendo adicionar manualmente uma RT que esteja fora do raio selecionado.

### Objetivo

Permitir que o gerente adapte a inteligência da rota à realidade operacional observada após o uso do sistema.

Exemplo:

* 5 km pode funcionar bem para determinada região;
* 8 ou 10 km podem ser mais adequados em outra situação;
* a alteração deve ser possível sem modificar o algoritmo principal.

### Regra arquitetural para o presente

**Não implementar esta opção agora.**

Na implementação atual, manter **5 km como valor padrão/configuração centralizada**.

Apenas garantir que o código não tenha o valor `5` espalhado em vários pontos, para que a futura transformação em valor configurável seja simples.

### Status

**NÃO IMPLEMENTAR AGORA — IDEIA REGISTRADA PARA EVOLUÇÃO FUTURA.**

**Pré-requisito arquitetural já satisfeito (16/08/2026, B1 da Fase 2):** `ROUTE_PROXIMITY_RADIUS_KM = 5` já nasceu centralizado em `lib/routing/config.ts` desde a primeira versão do motor de sugestão — conferido via busca no código, é a única definição e o único consumo (`lib/routing/intelligent-route.ts`), nenhum `5` solto em outro ponto. Não precisou de mudança nova pra atender esse pedido. O seletor de raio na tela "Montar Rota" continua **não implementado**, como pedido — só a base pra isso não travar depois já existe.
