# GUIA DE USO DAS SKILLS DE DESIGN — CLAUDE CODE

## Projeto

**Plataforma de Gestão Operacional de Manutenção das Residências Terapêuticas**

Stack principal:

- Next.js (App Router)
- React
- TypeScript
- Supabase
- PostgreSQL
- Tailwind CSS
- PWA
- Interface de mapa/rotas
- Painéis para Gerente, Técnico e Gestão

---

# 1. Objetivo deste documento

Este documento orienta o Claude Code sobre como utilizar três skills de design no desenvolvimento da plataforma:

1. `frontend-design`
2. `interface-design`
3. `frontend-design-audit`

A finalidade não é apenas criar uma interface "bonita".

O objetivo é construir uma **interface de produto profissional, original, funcional e coerente com uma plataforma real de gestão operacional**, evitando o padrão genérico frequentemente produzido por ferramentas de IA.

As três skills devem ser tratadas como camadas complementares:

```text
frontend-design
       ↓
Direção visual e identidade da interface
       ↓
interface-design
       ↓
Arquitetura e qualidade da interface de produto
       ↓
frontend-design-audit
       ↓
Revisão crítica e correção antes de considerar a tela pronta
```

---

# 2. Skills disponíveis

## 2.1 frontend-design

### Origem

Skill oficial do ecossistema Claude Code / Anthropic.

### Local

A skill oficial já está disponível no ambiente do Claude Code.

Não instalar uma cópia de terceiros caso a versão oficial já esteja disponível.

### Função

Usar como a principal referência para a **direção visual da interface**.

Ela deve ajudar a evitar:

- aparência genérica de dashboard;
- escolha automática de fontes populares sem justificativa;
- paletas previsíveis;
- excesso de cards iguais;
- layouts repetitivos;
- gradientes decorativos sem função;
- composição sem personalidade;
- interfaces com aparência de template de IA.

### Como utilizar

Antes de implementar uma tela importante, definir:

- usuário da tela;
- objetivo principal;
- tarefa principal;
- hierarquia das informações;
- densidade necessária;
- direção visual;
- tipografia;
- sistema de cores;
- composição;
- estados;
- interações;
- responsividade.

Não começar simplesmente com:

> "Crie um dashboard."

Primeiro entender o problema que a tela resolve.

---

# 3. interface-design

### Origem

Skill de terceiros, instalada localmente em:

```text
.claude/skills/interface-design
```

### Função

Usar como referência para **design de interfaces de produto**, principalmente:

- dashboards;
- SaaS;
- painéis administrativos;
- ferramentas operacionais;
- interfaces com grande quantidade de dados;
- tabelas;
- filtros;
- estados;
- navegação;
- hierarquia;
- design system;
- consistência entre telas.

Essa skill é especialmente relevante para este projeto porque a aplicação não é uma landing page.

Ela é uma ferramenta operacional utilizada diariamente.

### Como utilizar

Aplicar principalmente nas telas:

- Dashboard do Gerente;
- Montar Rota;
- Rotas Confirmadas;
- Painel da Gestão;
- Validação;
- Relatórios;
- Visualização de RTs;
- Chamados;
- Mapa operacional.

A interface deve priorizar **clareza operacional**, e não efeitos visuais.

---

# 4. frontend-design-audit

### Origem

Skill de terceiros, instalada localmente em:

```text
.claude/skills/frontend-design-audit
```

### Função

Usar como etapa de **auditoria crítica após a implementação da interface**.

A skill não deve ser utilizada apenas para perguntar:

> "A tela está bonita?"

Ela deve ajudar a identificar:

- problemas de hierarquia visual;
- inconsistências;
- excesso de elementos;
- espaçamento inadequado;
- problemas de usabilidade;
- problemas de responsividade;
- problemas de acessibilidade;
- componentes incoerentes;
- estados mal representados;
- decisões visuais genéricas;
- excesso de ruído;
- elementos que não possuem função;
- problemas de navegação;
- inconsistências entre telas.

---

# 5. Regra fundamental: as três skills não devem competir

Não tratar as três skills como três designers independentes.

Usar cada uma para uma finalidade específica.

## Ordem recomendada

### Etapa 1 — frontend-design

Definir a direção visual e a personalidade da interface.

### Etapa 2 — interface-design

Estruturar a interface como produto de software, garantindo hierarquia, navegação, densidade e consistência.

### Etapa 3 — implementação

Construir a tela com os componentes e tecnologias do projeto.

### Etapa 4 — frontend-design-audit

Auditar a implementação real.

### Etapa 5 — run

Abrir a aplicação no navegador e verificar o comportamento real.

### Etapa 6 — correção

Corrigir os problemas encontrados.

---

# 6. Não criar um "dashboard genérico de IA"

Esta regra é obrigatória.

Evitar automaticamente a composição:

```text
Sidebar
+
Título
+
4 cards de KPI
+
Gráfico
+
Tabela
```

Esse padrão só deve ser utilizado quando realmente fizer sentido para a tarefa.

Não utilizar automaticamente:

- roxo + azul como identidade;
- gradientes decorativos;
- excesso de sombras;
- cards arredondados em tudo;
- ícones em todos os lugares;
- gráficos apenas para ocupar espaço;
- grandes áreas vazias sem função;
- fontes genéricas sem decisão de design;
- componentes repetidos sem hierarquia.

Toda escolha visual deve ter uma justificativa funcional.

---

# 7. O sistema possui três personas diferentes

Não criar uma única experiência visual para todos os usuários.

## 7.1 Gerente / responsável operacional

### Características

Alta densidade de informação.

Precisa tomar decisões rapidamente.

### Objetivo

Responder:

> "O que precisa de atenção?"

> "Onde devo concentrar a operação?"

> "Qual rota devo montar?"

### Interface

Deve priorizar:

- mapa;
- regiões;
- RTs;
- quantidade de chamados;
- prioridade;
- SLA;
- rotas;
- status de execução;
- filtros rápidos;
- ações operacionais.

A interface pode ser mais densa.

---

# 8. Persona do Técnico

## Objetivo

Responder apenas:

> "O que preciso fazer agora?"

> "Onde preciso ir?"

> "Como registro que fiz?"

### Interface

Deve ser:

- mobile-first;
- simples;
- rápida;
- com poucos elementos;
- com botões grandes;
- com linguagem direta;
- fácil de utilizar com uma mão;
- otimizada para celular.

Não transformar a tela do técnico em um mini dashboard.

Evitar gráficos, indicadores desnecessários e menus complexos.

### Fluxo principal

```text
Meus serviços
     ↓
Abrir serviço
     ↓
Ver RT/endereço/chamado
     ↓
Iniciar
     ↓
Executar
     ↓
Concluir
     ↓
Foto/OS
     ↓
Enviar
```

---

# 9. Persona da Gestão

## Objetivo

Responder:

> "Como está a operação?"

> "Onde estão os problemas?"

> "Quais regiões ou RTs precisam de atenção?"

### Interface

Priorizar:

- visão consolidada;
- indicadores;
- SLA;
- criticidade;
- regiões;
- RTs;
- evolução ao longo do tempo;
- gargalos;
- relatórios.

A gestão não precisa da mesma densidade operacional do gerente.

---

# 10. O design deve partir das decisões

Antes de construir qualquer tela, identificar:

### Qual decisão o usuário precisa tomar?

Exemplo:

Tela "Montar Rota":

Decisão:

> "Quais RTs devem fazer parte da rota de hoje?"

Portanto, devem receber destaque:

- região;
- quantidade de chamados;
- prioridade;
- SLA;
- localização;
- distância;
- sugestão de rota.

Não dar o mesmo peso visual para informações secundárias.

---

# 11. Hierarquia visual

Cada tela deve ter:

### Informação primária

O usuário precisa perceber primeiro.

### Informação secundária

Ajuda na decisão.

### Informação terciária

Detalhes acessados quando necessário.

Não colocar todos os dados com o mesmo peso.

---

# 12. Sistema visual

Antes de construir várias telas, estabelecer um pequeno design system.

Definir:

- tipografia;
- tamanhos de texto;
- pesos;
- espaçamento;
- raio de borda;
- sombras;
- ícones;
- botões;
- inputs;
- tabelas;
- badges;
- modais;
- dropdowns;
- estados;
- cores.

Depois reutilizar o sistema.

Não reinventar o estilo em cada página.

---

# 13. Sistema de cores funcional

As cores possuem significado operacional.

## Prioridade

🔴 Emergencial

🟠 Alta

🟡 Normal

🔵 Baixa

## SLA

🟢 Dentro do SLA

🟡 Próximo do vencimento

🟣 SLA vencido

As cores devem possuir também:

- texto;
- ícone;
- label;

Nunca depender exclusivamente da cor para comunicar significado.

---

# 14. Estados precisam ser visíveis

O sistema possui estados diferentes que não podem ser confundidos.

### Serviço

```text
planejado
↓
em_deslocamento
↓
em_execucao
↓
concluido_tecnico
↓
aguardando_validacao
↓
validado
```

O design deve representar claramente cada estado.

Especialmente:

**"Concluído pelo técnico"**

não significa:

**"Finalizado administrativamente"**.

Essa diferença é uma regra de negócio crítica do sistema.

---

# 15. Design orientado a contexto

Não usar um único componente ou visual para todas as situações.

Exemplo:

### Lista do técnico

Pode ser composta por grandes itens de toque.

### Tabela da gestão

Pode ser mais compacta e densa.

### Mapa do gerente

Pode usar visual espacial e filtros.

### Relatório

Pode utilizar hierarquia documental.

A consistência deve vir do **design system**, não de tornar todas as telas iguais.

---

# 16. Mapa operacional

O mapa não deve ser usado simplesmente porque "fica bonito".

Ele existe para responder:

> "Onde estão concentrados os problemas?"

Cada RT deve possuir contexto visual.

Exemplo:

```text
RT 042 — Campo Grande

8 chamados
2 emergenciais
3 SLA vencidos
2 em execução
1 concluído hoje
```

O usuário deve conseguir:

- localizar;
- filtrar;
- selecionar;
- aprofundar;
- entender o contexto.

---

# 17. Visualização de dados

Quando utilizar gráficos, perguntar primeiro:

> "Qual decisão esse gráfico ajuda a tomar?"

Não criar gráficos apenas para preencher o dashboard.

Exemplos de visualizações que podem possuir função:

- chamados por região;
- SLA por região;
- volume por RT;
- chamados por status;
- evolução diária;
- tempo médio de resolução.

Exemplos que devem ser evitados:

- gráficos decorativos;
- gráficos redundantes;
- gráficos sem ação associada.

---

# 18. Auditoria obrigatória

Depois de implementar uma tela importante:

1. Executar a aplicação.
2. Abrir a tela no navegador.
3. Utilizar `frontend-design-audit`.
4. Identificar problemas.
5. Corrigir.
6. Executar novamente.
7. Verificar desktop.
8. Verificar mobile quando aplicável.

Uma tela não deve ser considerada pronta apenas porque:

- compilou;
- não apresentou erro;
- os componentes renderizaram.

Ela precisa ser visualmente revisada.

---

# 19. Critérios de aceitação visual

Antes de considerar uma tela concluída, verificar:

### Hierarquia

É evidente o que devo olhar primeiro?

### Clareza

Consigo entender a tela sem precisar estudar a interface?

### Densidade

Existe informação demais ou de menos?

### Consistência

Os componentes seguem o mesmo sistema visual?

### Acessibilidade

Textos, estados e ações são compreensíveis?

### Responsividade

A tela funciona corretamente nos tamanhos relevantes?

### Originalidade

A tela parece um produto específico ou um template genérico de IA?

### Utilidade

Cada elemento visual possui uma função?

---

# 20. Regra contra estética artificial

Não adicionar elementos apenas para deixar a interface "mais bonita".

Não adicionar:

- gradientes sem propósito;
- animações excessivas;
- efeitos de brilho;
- glassmorphism indiscriminado;
- sombras exageradas;
- ícones decorativos;
- gráficos inúteis;
- cards redundantes.

Animações devem possuir propósito, como:

- feedback;
- transição;
- confirmação;
- mudança de estado;
- carregamento.

---

# 21. Regra de consistência

Quando um componente já estiver aprovado visualmente, reutilizá-lo.

Exemplo:

Se o badge de SLA foi definido como:

```text
🟣 SLA VENCIDO
```

não criar outra versão visual diferente em outra tela.

O mesmo vale para:

- botões;
- filtros;
- inputs;
- tabelas;
- status;
- modais;
- cards;
- navegação.

---

# 22. Processo obrigatório para novas telas

Sempre seguir esta sequência:

```text
1. Entender a persona
        ↓
2. Definir objetivo da tela
        ↓
3. Definir decisões do usuário
        ↓
4. Definir hierarquia
        ↓
5. Definir direção visual
        ↓
6. Consultar frontend-design
        ↓
7. Consultar interface-design
        ↓
8. Implementar
        ↓
9. Rodar a aplicação
        ↓
10. Auditar com frontend-design-audit
        ↓
11. Corrigir
        ↓
12. Verificar novamente
```

---

# 23. Regra para Claude Code

Antes de criar uma nova tela importante, não iniciar imediatamente pela codificação.

Primeiro apresentar internamente ou no plano de implementação:

- Persona;
- objetivo;
- informação prioritária;
- ação principal;
- hierarquia;
- comportamento responsivo;
- componentes necessários;
- direção visual.

Depois implementar.

---

# 24. Regra para alterações existentes

Não mudar o design de uma tela inteira simplesmente para adicionar uma funcionalidade.

Primeiro verificar:

- design system;
- componentes existentes;
- padrões;
- hierarquia atual.

Adicionar a funcionalidade de forma coerente com o produto.

---

# 25. Resultado esperado

O sistema deve parecer:

**uma plataforma profissional de gestão operacional desenvolvida especificamente para este processo**, e não:

**um dashboard genérico produzido por IA.**

O design deve transmitir:

- confiança;
- organização;
- clareza;
- eficiência;
- controle operacional;
- modernidade sem exageros.

---

# 26. Ordem de prioridade das três skills

## 1º — frontend-design

Responsável pela direção visual e identidade.

## 2º — interface-design

Responsável pela arquitetura da interface de produto e consistência.

## 3º — frontend-design-audit

Responsável pela crítica e validação da interface construída.

Nenhuma delas substitui as outras.

---

# 27. Regra final

**Design é parte da funcionalidade.**

Uma interface só está pronta quando:

- funciona;
- é compreensível;
- possui hierarquia;
- respeita a persona;
- é consistente;
- é acessível;
- funciona no dispositivo adequado;
- foi visualmente auditada;
- não apresenta o padrão genérico de interface gerada automaticamente.

Não considerar uma tela concluída apenas por estar tecnicamente funcional.
