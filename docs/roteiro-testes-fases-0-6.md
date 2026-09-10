# Roteiro de testes — Evolução para plataforma operacional (Fases 0–6)

Passo a passo pra conferir no navegador cada mudança das Fases 0 a 6. Não precisa
de conhecimento técnico — siga os passos e compare com o **Resultado esperado**.

> Referência do que cada fase entrega: `CLAUDE.md`, seção "Estado atual", bloco
> **"Evolução para plataforma operacional"**.

---

## 1. Antes de começar

### Migrations
Confirme com quem administra o Supabase que as migrations **0034 a 0039** foram
aplicadas. Sem elas, várias telas dão erro de carregamento.

### Contas de teste
Senha de todas: `senha-teste-123`

| Perfil  | E-mail                     |
|---------|----------------------------|
| Gerente | `gerente.teste@csm.local`  |
| Gestão  | `gestao.teste@csm.local`   |
| Técnico | `tecnico.teste@csm.local`  |
| Técnico | `joaozinho.teste@csm.local`|
| Técnico | `pedrinho.teste@csm.local` |

### Zerar e recomeçar (opcional)
Pra testar do zero. **Com o `npm run dev` parado**, na raiz do projeto:

```
node scripts/reset-dados-operacionais.mjs              # só mostra o que apagaria
node scripts/reset-dados-operacionais.mjs --confirmar  # apaga de verdade
```

Apaga rotas, serviços, histórico, posições de técnico e chamados fictícios.
**Preserva** RTs, CAPS, zonas, regiões, equipes e usuários. Depois, na tela
**Chamados**, clique em **Sincronizar com o TomTicket** pra repovoar os chamados
reais.

---

## 2. Preparação: montar uma rota

Quase todas as fases precisam de uma rota confirmada com serviços. Faça isto uma vez:

1. Login como **gerente**.
2. Menu → **Montar rota**.
3. Escolha uma região no filtro. Aparecem RTs candidatas no mapa e na lista.
4. Clique em **+ Adicionar** em 1 ou 2 RTs — de preferência com chamados em aberto
   (o número em rosa ao lado do endereço).
5. Clique em **Confirmar rota**.
6. No diálogo: **data = hoje**, escolha uma **equipe** e, para cada RT, escolha um
   **técnico** (ex.: Joãozinho).
7. Confirme.

**Resultado esperado:** mensagem de sucesso. Os chamados em aberto dessas RTs viram
serviços `planejado` do técnico escolhido — base para as Fases 0, 4, 5 e 6.

---

## Fase 0 — o técnico recebe todos os chamados da RT

**O que mudou:** antes o gerente marcava, um a um, quais chamados o técnico ia
atender. Voltou a ser: confirmou a rota → o técnico recebe **todos** os chamados em
aberto da RT.

**Passos**
1. Refaça o passo 2 (Montar rota), prestando atenção no diálogo de **Confirmar rota**.

**Resultado esperado**
- O diálogo mostra só: **data**, **equipe** e, por RT, um **seletor de técnico**.
- **Não** há checkbox por chamado, nem lista expansível de chamados, nem contador
  "8 de 8".
- Depois de confirmar, entre como o técnico escolhido → **Meus serviços** → todos
  os chamados em aberto daquela RT estão lá (agrupados por RT, expansível).

---

## Fase 1 — reexecução visível (Retorno + Tentativa anterior)

**O que mudou:** quando um atendimento não foi concluído (pendência) e precisa
voltar, o gerente agenda a nova execução numa rota **que já existe**, e o técnico
passa a ver o histórico da tentativa anterior.

### 1a. Técnico reporta uma pendência (para ter o que reexecutar)
1. Entre como **técnico** com um serviço `planejado` (da preparação).
2. Abra o serviço → **Iniciar atendimento** (anexe uma foto).
3. Abra o bloco laranja **"Não consegui concluir o atendimento"**.
4. Escolha um tipo (ex.: "Precisa de decisão da gestão"), descreva, anexe a foto do
   parcial + a OS → **Reportar pendência**.

**Resultado esperado:** o serviço fica **"Cancelado"** e some de "Meus serviços".

### 1b. Gerente programa a nova execução
1. A reexecução é **anexada a uma rota que já está confirmada** — não confirme uma
   rota nova só para isso (uma rota nova que inclua a RT já pega o chamado sozinha).
   Use a **própria rota de hoje onde a pendência aconteceu** (já está confirmada), ou
   qualquer outra rota confirmada de hoje em diante.
2. Menu → **Pendências**.
3. No card da pendência, clique em **Programar nova execução**.
4. No diálogo: escolha essa rota, o técnico e (opcional) uma observação → confirme.

**Resultado esperado:** a pendência some da lista de **Pendências**, e o chamado ganha
um serviço `planejado` novo nessa rota (aparece para o técnico como retorno — 1c).

> A sincronização automática (a cada 5 min) **não** recoloca sozinha um chamado que
> virou pendência na rota dele — desde a migration `0040`, isso é decisão do gerente,
> por aqui.

### 1c. Técnico vê o retorno
1. Entre como o técnico da rota nova → **Meus serviços**.
2. O serviço da RT aparece com um badge laranja **"↩ Retorno"**.
3. Abra o serviço → há uma seção laranja **"↩ Tentativa anterior"** com: quem
   atendeu, quando, o motivo da pendência e as fotos/OS da vez anterior.

---

## Fase 2 — histórico de endereço da RT

**O que mudou:** tela nova de detalhe da RT (só **gestão**) mostrando o endereço
atual e o histórico de endereços, com contagem de chamados por período.

**Passos**
1. Login como **gestão**.
2. Menu → **RTs**.
3. Clique no **código** de uma RT (o código virou link). Sugestões:
   - **SRT 70** — nunca trocou de endereço.
   - **RT TESTE ESCRITÓRIO** — tem 2 períodos de endereço (dado de teste da fase).

**Resultado esperado**
- Cabeçalho com código + nome + status.
- Grade com **CAPS**, **zona**, **região**.
- Bloco **"Endereço atual"** com 3 contagens: chamados **criados**, **finalizados**
  e **em aberto** naquele endereço.
- **"Histórico de endereços"**:
  - Se nunca trocou → *"Sem trocas de endereço registradas"* (caso SRT 70).
  - Se trocou → um card por período anterior, com o endereço, o intervalo de datas,
    o motivo e as contagens (caso RT TESTE ESCRITÓRIO).

---

## Fase 3 — respostas e anexos do cliente + sino global

**O que mudou:** o sistema passou a trazer do TomTicket as respostas do cliente e
os anexos (fotos), e avisa quando há resposta nova.

**Pré-requisito:** a sincronização com o TomTicket precisa ter rodado e trazido
respostas de cliente. Se o sino estiver em **0**, é porque não há resposta nova na
janela — mesmo assim dá para ver a conversa de um chamado que já tenha respostas.

**Passos**
1. Login como **gerente** ou **gestão**.
2. Olhe o **menu** (barra do topo): se houver respostas não vistas, aparece um
   **🔔 com um número** ao lado de "Sair".
3. Menu → **Chamados**.
4. Se houver respostas novas, aparece o botão **"🔔 N com resposta nova"** ao lado
   dos filtros. Clique → a lista filtra só os chamados com resposta nova; as linhas
   correspondentes têm um 🔔 no assunto.
5. Clique num chamado → o modal abre com duas seções novas:
   - **"Evidências do cliente"** — miniaturas das fotos que o cliente anexou.
   - **"Conversa do chamado"** — as mensagens trocadas (cliente e atendente), com
     quem enviou e quando.
6. Feche o modal.

**Resultado esperado:** o número do 🔔 no menu **diminui** (aquele chamado foi
marcado como visto). Com o sistema aberto em duas abas, o número atualiza sozinho
(tempo real).

**Técnico:** entre como técnico, abra um serviço cujo chamado tenha anexo do
cliente → há a seção **"Evidências do cliente"** com as fotos (o técnico **não** vê
a conversa nem o sino).

---

## Fase 4 — o técnico aponta um problema no serviço

**O que mudou:** antes de iniciar, o técnico pode avisar que o serviço tem um
problema (chamado já resolvido, RT errada, escopo diferente…) **sem cancelar nem
iniciar**. O gerente vê e decide.

### 4a. Técnico aponta
1. Entre como **técnico** com um serviço `planejado`.
2. Abra o serviço. Abaixo do botão "Iniciar atendimento" há um link discreto
   **"Este serviço tem um problema"**.
3. Clique → abre um formulário: descreva o problema + anexe uma foto (obrigatória)
   → **Enviar apontamento**.

**Resultado esperado:** o formulário some e aparece a nota **"⚠ Você apontou um
problema neste serviço em DD/MM — o gerente foi avisado"**. O botão "Iniciar
atendimento" continua lá — o serviço **não** muda de estado.

### 4b. Gerente vê
1. Entre como **gerente** → menu → **Validação**.
2. No resumo do topo há um card **"Apontados pelo técnico"**.
3. Role até a seção **"Apontados pelo técnico"**: o card mostra a RT, o chamado, o
   técnico, a descrição do problema, a foto e a linha do tempo.
4. Botão **"Reagendar"**: se clicar e confirmar com um motivo, o serviço volta para
   a fila e o card some.

---

## Fase 5 — rota do dia ao vivo — **REMOVIDA (10/09/2026)**

A tela "Rota do dia" e o rastreamento de GPS do técnico foram **retirados do
sistema**. Motivo: acompanhar a posição do técnico ao vivo vira ruído e lê como
fiscalização — ele para para almoçar, sai de uma RT para comprar material e volta.
O cálculo de rota/tempo por carro passou a ser feito por OSRM (sem o billing do
Google). **Não há nada para testar aqui** — o item "Rota do dia" não existe mais no
menu, e a interface do técnico não pede localização para rastreio (só continua
pedindo para a foto carimbada, que é da Fase 3/auditoria).

---

## Fase 6 — "Solicitar correção" + Validação reorganizada

**O que mudou:** a antiga ação **"Recusar"** virou **"Solicitar correção"** (mesmo
efeito por baixo, linguagem menos dura). A tela de **Validação** foi reordenada
para mostrar primeiro o que precisa de decisão.

### 6a. Reorganização
1. Entre como **gerente** → menu → **Validação**.

**Resultado esperado:** as seções aparecem nesta ordem:
1. **Aguardando validação** — o que o técnico concluiu e espera o gerente.
2. **Apontados pelo técnico** (Fase 4).
3. **Travados em rota já passada**.
4. **Validados recentemente** — arquivo; era a primeira, agora é a última.

Os 4 cards do topo seguem a mesma ordem e levam direto para cada seção.

### 6b. Solicitar correção
**Pré-requisito:** um serviço **concluído pelo técnico**, aguardando validação.
Para ter um: entre como técnico → abra um serviço `planejado` → **Iniciar** (com
foto) → preencha observação + foto de depois + OS → **Concluir serviço**.

1. Entre como **gerente** → **Validação** → seção **"Aguardando validação"**.
2. No card, a evidência aparece como **miniaturas** (Foto antes / Foto depois / OS)
   — antes eram só links de texto.
3. Clique em **"Solicitar correção"** (botão com contorno, ao lado de "Validar").
4. No diálogo: **"O que precisa ser corrigido?"** → escreva o que ajustar →
   **"Enviar solicitação"**.

**Resultado esperado:** o card some de "Aguardando validação". O chamado volta para
a fila e, quando reentrar numa rota, aparece para o técnico como **"↩ Retorno"**
(Fase 1). Na tela **Chamados**, abrindo esse chamado, a linha do tempo mostra o
evento **"Correção solicitada"** com o texto que você escreveu.

---

## Checklist rápido

| Fase | Onde | O que conferir |
|------|------|----------------|
| 0 | Gerente → Montar rota → Confirmar | diálogo sem checkbox por chamado |
| 1 | Técnico | badge "↩ Retorno" + seção "Tentativa anterior" |
| 2 | Gestão → RTs → clicar no código | tela de detalhe com histórico de endereços |
| 3 | Menu (🔔) + Chamados | sino, filtro "resposta nova", "Conversa do chamado" |
| 4 | Técnico (serviço planejado) + Gerente → Validação | link "Este serviço tem um problema" + seção "Apontados" |
| 5 | — | removida (10/09) — "Rota do dia" não existe mais |
| 6 | Gerente → Validação | ordem nova, miniaturas, botão "Solicitar correção" |
