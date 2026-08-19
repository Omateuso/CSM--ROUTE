# Plano de Fases — Plataforma de Gestão Operacional de Manutenção das RTs

Projeto: iGEDES × CSM — Residências Terapêuticas (SRT)
Assistente de desenvolvimento: **Programador Pedro** (Claude Code, extensão VS Code)
Stack: **Next.js (App Router) + TypeScript + Supabase (Postgres, Auth, Storage) + Tailwind CSS**, PWA instalável.

> Este documento é o roteiro técnico. Cada fase parte apenas da anterior — não pule fase, mesmo que pareça mais rápido implementar uma tela "adiantada". A ordem existe porque a Fase 3 (execução em campo) depende de RTs e rotas já existirem, e a Fase 4 (gestão) depende de dados reais de execução para fazer sentido.

## Visão geral das fases

| Fase | Nome | Entrega principal |
|---|---|---|
| 1 | Base Operacional | RTs, zonas, chamados, prioridade/SLA, mapa, dashboard básico |
| 2 | Rotas | Montagem de rota, sugestão inteligente, confirmação, histórico |
| 3 | Execução | Perfil técnico mobile, iniciar/concluir serviço, fotos/OS/evidências |
| 4 | Gestão | Painel do gerente, painel da gestão, validação, relatório diário, gargalos |
| 5 | Evoluções Futuras | Integração profunda TomTicket, notificações, indicadores avançados, automações |

Regra de negócio que atravessa todas as fases: **prioridade e SLA são camadas independentes** (um chamado pode ser Emergencial *e* SLA vencido ao mesmo tempo) e **"concluído pelo técnico" não é o mesmo que "finalizado administrativamente"** — só vira finalizado depois da validação do gerente.

---

## FASE 1 — Base Operacional

**Objetivo:** ter os dados fundamentais no ar (RTs, regiões, chamados) e uma primeira visão (dashboard + mapa) que já entrega valor sozinha, antes de qualquer lógica de rota ou execução existir.

### Setup de projeto
- Criar projeto Next.js (App Router, TypeScript, Tailwind).
- Configurar projeto Supabase (Postgres + Auth + Storage) e variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` só no servidor).
- Configurar manifest.json + service worker (PWA instalável) — usar `next-pwa` ou implementação manual.
- Configurar autenticação Supabase com 3 perfis: `gerente`, `tecnico`, `gestao` (ver `perfis` no schema).
- Deploy inicial (Vercel recomendado, por integrar nativamente com Next.js).

### Dados e telas
- **Cadastro de RTs**: código, nome, endereço, bairro, região, latitude/longitude, status ativo/inativo. **Endereço tem histórico** (tabela `rt_enderecos`, migration `0005`) — a tela de edição precisa de um fluxo separado "trocar endereço" (via `fn_trocar_endereco_rt`) em vez de UPDATE direto nas colunas de endereço/lat/long, senão perde o histórico de chamados quando a RT muda de imóvel. Ver regra completa no `CLAUDE.md`. **Permissão (ago/2026, migration `0006`): cadastro de RT (criar, editar, trocar endereço) é exclusivo do perfil `gestao`, não `gerente`** — telas ficam em `(gestao)/rts`, não `(gerente)/rts`. Isso antecipa a existência do grupo de rotas `(gestao)` para a Fase 1, mesmo que o restante do que a gestão vê (painel consolidado, relatórios) só chegue na Fase 4.
- **Cadastro de zonas/regiões**: hierarquia zona → região/bairro.
- **Chamados**: entrada manual inicial (tabela `chamados`) com prioridade, SLA, RT vinculada — a sincronização automática com o TomTicket fica para a Fase 5, mas o campo `tomticket_id` já existe desde já para não precisar migrar depois.
- **Regras de SLA**: tabela `sla_regras` (prazo em horas por prioridade), campo calculado/derivado de status do SLA (dentro / próximo / vencido).
- **Dashboard principal**: chamados abertos, críticos, SLA vencido, em execução, concluídos hoje (fica com placeholder até a Fase 3 existir de fato), RTs com maior volume.
- **Mapa operacional**: RTs plotadas por lat/long, marcador colorido por nível de atenção (usar Mapbox GL ou Leaflet — ambos com free tier compatível com uso interno).
- **Filtros básicos**: por região, prioridade, SLA.

### Definition of done da Fase 1
- Um gerente autenticado consegue ver todas as RTs no mapa e no dashboard, com números reais (mesmo que os chamados sejam inseridos manualmente por enquanto).
- Prioridade e SLA aparecem visualmente distintos (cores + ícone/texto, nunca só cor).

---

## FASE 2 — Rotas

**Objetivo:** permitir que o gerente monte, ajuste e confirme uma rota de atendimento, com uma rota inteligente que funciona como **copiloto de planejamento** — o Google Maps fornece dados geográficos e de deslocamento, o sistema interpreta esses dados junto com os dados operacionais dos chamados, e o gerente toma a decisão final. A aplicação ajuda a montar uma rota melhor sem engessar a operação.

Estrutura em 3 partes — **Parte A não muda com o ajuste abaixo (16/08)**; Parte B recebeu especificação detalhada; Parte C se mantém como já estava desenhada.

### Parte A — Equipes e técnicos (plano já definido, não alterar)

- Migration para permitir INSERT/UPDATE em `equipes`, exclusiva do perfil `gerente`.
- Policy de UPDATE em `profiles`, exclusiva do perfil `gerente` — o gerente pode alterar dados operacionais do técnico (ex.: equipe, disponibilidade), mas **nunca o `role`** do usuário.
- Tela de equipes.
- Vínculo de técnicos (perfil `tecnico`) a uma equipe.

### Parte B — Montar Rota (rota inteligente)

**Ajuste de especificação (16/08/2026):** antes de implementar a Parte B, a especificação abaixo é obrigatória. Ela preserva a arquitetura já planejada (Next.js + Supabase + backend-only para lógica sensível) e evolui a funcionalidade de montagem de rota.

**1. Objetivo.** A rota inteligente não escolhe simplesmente "a RT com mais chamados" nem "a RT mais próxima". Ela é um assistente de decisão operacional que responde: *"Considerando a última RT selecionada, quais são as melhores próximas RTs para atender, equilibrando deslocamento, tempo de viagem, volume, prioridade, SLA e concentração geográfica?"* O gerente sempre toma a decisão final — o sistema só sugere.

**2. Google Maps como camada geográfica.** Responsabilidades separadas:
- **Google Maps Platform** fornece: distância real de deslocamento, duração estimada de carro, matriz de distância/duração entre RTs, e (quando a API usada suportar) trânsito.
- **Nosso sistema** usa esses dados junto com: quantidade de chamados, prioridade, SLA, concentração geográfica, região, núcleo operacional. **O Google nunca decide sozinho qual RT é a melhor escolha** — quem pontua e decide é o nosso algoritmo.

**3. Raio inicial de proximidade.** 5 km, mas **configurável** via constante centralizada (ex.: `ROUTE_PROXIMITY_RADIUS_KM = 5`) — nunca hardcoded em múltiplos pontos do código. Precisa dar para mudar para 10 km (ou outro valor) sem reescrever lógica.

**4. Região não é barreira geográfica.** A região continua importante como organização/contexto/filtro da operação, mas não deve bloquear automaticamente uma RT de outra região que esteja geograficamente próxima e operacionalmente vantajosa (ex.: RT da região "Oeste 2" pode aparecer como candidata ao montar rota na "Oeste 1", se estiver perto). Resumindo: **região = filtro/organização; geografia = cálculo operacional.**

**5. Fluxo dinâmico e incremental.** A cada nova RT selecionada pelo gerente, o sistema recalcula as candidatas a partir da **última RT escolhida** — nunca continua usando a primeira RT como referência fixa.

**6. Primeira seleção.** Antes de haver qualquer RT selecionada: mostrar as RTs disponíveis na região, ordenadas por relevância operacional, com escolha manual livre ou uma sugestão inicial de rota. A lógica de proximidade dinâmica só ativa depois da primeira RT escolhida.

**7. Próximas melhores opções.** Depois de cada seleção, apresentar as candidatas próximas com distância, tempo estimado de carro, volume de chamados, SLA vencidos/próximos, e um rótulo qualitativo (ex.: "⭐ Recomendada", "Boa opção", "Alto deslocamento"). Os valores exibidos sempre vêm de dados reais, nunca fixos/mockados.

**8. Distância e tempo.** Não mostrar só distância geométrica (Haversine). Quando a integração Google estiver disponível, usar deslocamento real de carro: quilômetros + tempo estimado + situação de tráfego quando fizer sentido. A duração é sempre **estimativa**, nunca garantia.

**9. Algoritmo de pontuação.** Combina, no mínimo: distância (menor tende a ser melhor), tempo (idem), volume de chamados (maior aumenta relevância), prioridade (emergencial/alta aumentam relevância), SLA (vencido/próximo aumenta relevância), concentração geográfica (uma área com várias RTs próximas pode valer mais que uma RT isolada). **Nunca decidir com base em um único fator.** Comportamento esperado: uma RT mais perto com chamados críticos pode vencer uma RT mais longe com mais chamados normais — mas se a RT mais longe tiver vários chamados emergenciais, ela pode passar a ser a recomendada. O algoritmo precisa permitir os dois resultados dependendo dos dados reais.

**10. Explicabilidade.** Nunca mostrar só "RT C recomendada" — sempre mostrar o motivo (ex.: "Está a 3,2 km da última RT, possui 4 chamados e 2 estão com SLA vencido"). A recomendação precisa ser explicável para o gerente, sempre.

**11. Núcleo operacional (conceito novo).** Um núcleo é um conjunto de RTs geograficamente muito próximas (ex.: várias RTs no mesmo condomínio, com distância interna muito baixa). O sistema deve reconhecer essa concentração e não tratar obrigatoriamente cada RT do núcleo como uma decisão isolada.

**12. Força-tarefa (sugestão, não obrigação).** Quando houver concentração significativa de RTs próximas, o sistema pode sugerir "⚡ Força-tarefa recomendada" (ex.: "Foram identificadas 10 RTs próximas, totalizando 27 chamados... baixo deslocamento entre elas"), com ações **[ Aceitar força-tarefa ]** / **[ Continuar rota normal ]**. O gerente sempre mantém autonomia para aceitar ou não.

**13. Mapa dinâmico durante a montagem.** Ao selecionar uma RT: destacá-la no mapa, mostrar sua posição, destacar candidatas próximas com distância/tempo, atualizar as informações a cada seleção, destacar a sugestão principal. RTs fora do conjunto relevante podem ficar visualmente menos destacadas (não escondidas).

**14. Rota em construção.** Visualização sequencial e numerada (① RT A → ② RT C → ③ RT D), tanto em lista quanto no mapa — sequência, conexões entre paradas, candidatas próximas e possíveis núcleos visíveis.

**15. Impacto da escolha.** Quando possível, mostrar o impacto incremental de cada candidata (ex.: +3 chamados, +3,2 km, +8 min, +2 SLA vencidos) para ajudar o gerente a decidir de forma consciente.

**16. Edição manual sempre disponível.** Aceitar sugestão, adicionar RT, remover RT, reordenar, desmarcar tudo, montar a rota inteiramente manual. **A inteligência nunca bloqueia uma decisão operacional válida do gerente.**

**17. Arquitetura técnica.**
- Lógica de sugestão/pontuação sempre no **backend** (API Route do Next.js ou camada server-side equivalente) — nunca no client.
- Separar responsabilidades em duas pastas (a estrutura exata pode variar conforme a arquitetura real do projeto, mas a separação de responsabilidade é obrigatória):
  ```
  /lib/maps/google/     -- integração geográfica (Google Maps Platform)
      routes.ts
      matrix.ts
      geocoding.ts

  /lib/routing/          -- lógica de decisão operacional (nosso algoritmo)
      proximity.ts
      score.ts
      clusters.ts
      intelligent-route.ts
  ```

**18. Performance e custo.** Objetivo inicial: sugestão responde em **< 2s** para uma região com até ~30 RTs, quando possível. Reduzir custo/latência de API: primeiro filtrar candidatas por proximidade geográfica local (cálculo próprio, sem custo), só então consultar a API paga do Google (rota/tempo real) para as candidatas já reduzidas. Evitar chamadas desnecessárias ao Google — a estratégia de filtragem também é uma estratégia de custo de API.

**19. Fronteira com a Fase 3 — não antecipar.** Nesta parte, **não** implementar: iniciar serviço pelo técnico, concluir serviço, foto da OS, evidência, validação, painel de execução em tempo real. A Parte B só precisa **preparar a estrutura** (rotas confirmadas persistidas corretamente) para que a Fase 3 consuma isso depois.

**20. Interface.** Usar as skills `frontend-design`, `interface-design`, `frontend-design-audit` e `google-maps-platform` (essa última precisa ser confirmada/adicionada ao guia — ver nota em `CLAUDE.md`), conforme `docs/guia-skills-design.md`. A tela é uma **ferramenta de decisão operacional**, não um mapa decorativo — o gerente precisa conseguir responder visualmente: onde estão as RTs, quais estão próximas, quais são mais vantajosas, quanto vai deslocar, quanto tempo vai gastar, onde existe concentração de trabalho.

#### Definition of done da Parte B

A Parte B só é considerada concluída quando, tudo com dados reais (não mockado):
- gerente consegue selecionar RTs e o sistema sugere RTs;
- a lógica de proximidade funciona e candidatas podem vir de regiões próximas (região não bloqueia);
- a referência de proximidade muda a cada nova RT escolhida (não fica presa na primeira);
- distância é exibida sempre; tempo de carro é exibido quando a integração Google estiver disponível;
- volume, prioridade e SLA participam de fato da pontuação da recomendação;
- núcleos operacionais podem ser identificados e força-tarefa pode ser sugerida;
- gerente pode ignorar a sugestão e editar a rota livremente (aceitar / adicionar / remover / reordenar / desmarcar / montar manual);
- rota é confirmada e fica persistida; histórico funciona (ver Parte C).

### Parte C — Histórico

- **Confirmar Rota do Dia**: persiste `rotas` + `rota_rts`. Manter exatamente estes campos: data, região, equipe, responsável, RTs, ordem da rota, horário de confirmação.
- Sempre que fizer sentido, guardar também as informações que permitam reconstruir a rota confirmada (ex.: quais eram as candidatas/pontuação no momento da confirmação).
- **A rota confirmada é um registro histórico** — alterações posteriores (ex.: RT mudou de endereço, chamado foi cancelado) não podem apagar ou reescrever a rota que realmente foi confirmada naquele dia.
- **Histórico de rotas**: tela "Rotas Confirmadas", consulta por data/região/equipe.

### Setup específico da Fase 2

- **Google Maps Platform**: chave de API já obtida pelo usuário (16/08). Nunca hardcodar a chave no código — variável de ambiente, com placeholder em `.env.example`. Prever que podem ser necessárias **duas chaves com restrições diferentes**: uma server-side (Directions/Distance Matrix/Geocoding — chamadas do backend, restringir por IP no Google Cloud Console) e, se a tela renderizar um mapa interativo no client (Google Maps JavaScript API), uma `NEXT_PUBLIC_...` separada e restrita por referrer/domínio — não reusar a mesma chave sem restrição nas duas pontas. Confirmar com o usuário quais APIs do Google Maps Platform foram habilitadas no projeto dele antes de assumir qual está disponível (Directions API, Distance Matrix API, Geocoding API, Maps JavaScript API são as prováveis candidatas).

### Definition of done da Fase 2
- Uma rota confirmada gera registros reais em `rotas`/`rota_rts` e aparece no histórico.
- A sugestão de rota responde em tempo aceitável (< 2s) para uma região com até ~30 RTs.
- Todos os itens da "Definition of done da Parte B" acima estão satisfeitos.

---

## FASE 3 — Execução

**Objetivo:** dar ao técnico uma interface simples de celular para registrar a execução do serviço, fechando o ciclo entre "rota confirmada" e "evidência registrada".

### Dados e telas
- **Perfil técnico**: interface mobile-first, poucos botões, PWA instalável na tela inicial do celular.
- **"Meus Serviços de Hoje"**: lista dos serviços do dia do técnico logado, vindos da rota confirmada, com prioridade visível.
- **Iniciar atendimento**: mostra RT, endereço, chamado, descrição, prazo; cria/atualiza registro em `servicos` com status `em_deslocamento` → `em_execucao`.
- **Concluir serviço**: formulário com observação obrigatória + foto/evidência (upload para Supabase Storage) + anexo de OS (imagem ou PDF). Ao enviar, status vai para `concluido_tecnico`.
- **Registro de execução/conclusão**: tabelas `execucoes` (linha do tempo de início/fim), `conclusoes` (observação final do técnico — reaproveita o conceito de `chamado_conclusoes` do projeto anterior) e `evidencias` (fotos/documentos vinculados ao serviço).
- **Estados do serviço** (pipeline visual, também usado nas Fases 4): `planejado → em_deslocamento → em_execucao → concluido_tecnico → aguardando_validacao → validado`.

### Definition of done da Fase 3
- Um técnico consegue, do celular, abrir seu serviço do dia, iniciar, concluir com foto e observação, e isso aparece imediatamente (Supabase Realtime ou refetch) no painel do gerente como `concluido_tecnico`.

---

## FASE 4 — Gestão

**Objetivo:** dar visibilidade e fechamento ao ciclo — validação, indicadores, relatório e identificação de gargalos.

### Dados e telas
- **Validação**: gerente confere o serviço `concluido_tecnico` (foto, OS, observação) e valida → status `validado`, grava em `validacoes` (quem validou, quando, observação) e atualiza o chamado/histórico.
- **Painel do gerente**: operação do dia em tempo real (planejados / concluídos / em execução / não iniciados / reagendados), por região e por técnico.
- **Identificação de gargalos**: visão de onde a operação está parada (aguardando atendimento / em execução / concluído pelo técnico aguardando validação / validado), derivada dos status de `servicos`.
- **Painel da gestão**: visão consolidada por região/RT/SLA/criticidade/rotas/histórico, indicadores.
- **Relatório diário**: geração automática via view SQL (`vw_relatorio_diario` já vem no schema inicial); se precisar de histórico persistido por dia (ex.: para comparar meses), criar uma tabela `relatorios_diarios` na Fase 5.
- **Histórico/linha do tempo do chamado**: tabela `historico`, populada por trigger ou pela própria aplicação a cada mudança de status relevante.
- **Botão "Abrir no TomTicket"**: link direto usando `chamados.tomticket_id`.

### Definition of done da Fase 4
- A gestão consegue, sem falar com ninguém, responder: quantos chamados críticos existem agora, quantos estão com SLA vencido, e onde (em qual etapa) a operação está travada.

---

## FASE 5 — Evoluções Futuras (não implementar agora, só deixar preparado)

- Integração mais profunda com TomTicket (webhook/API em vez de entrada manual — o campo `tomticket_id` desde a Fase 1 existe justamente para essa migração ser incremental).
- Notificações push (novo chamado crítico, SLA prestes a vencer).
- Indicadores avançados: tempo médio de atendimento, tempo médio de resolução, chamados reincidentes, taxa de cumprimento de SLA, volume por tipo de serviço.
- Automações (ex.: auto-sugestão de rota do dia seguinte).
- Possível mecanismo de incentivo/bonificação — **citar apenas como possibilidade**, não desenhar schema nem tela para isso agora; depende de aprovação da gestão e compatibilidade contratual.

---

## Estrutura de pastas sugerida (Next.js)

```
/app
  /(auth)/login
  /(gerente)/dashboard
  /(gerente)/mapa
  /(gerente)/equipes   <!-- cadastro de equipes + vínculo de técnicos, Fase 2 Parte A -->
  /(gerente)/rotas/montar
  /(gerente)/rotas/confirmadas
  /(gerente)/validacao
  /(tecnico)/servicos-do-dia
  /(tecnico)/servico/[id]
  /(gestao)/rts        <!-- cadastro de RTs — exclusivo gestão desde a Fase 1, ver nota acima -->
  /(gestao)/painel
  /(gestao)/relatorios
  /api/... (rotas server-side quando precisar de service role ou lógica de sugestão de rota)
/components
/lib/supabase (client.ts, server.ts)
/lib/maps/google (routes.ts, matrix.ts, geocoding.ts — integração Google Maps Platform, Fase 2)
/lib/routing (proximity.ts, score.ts, clusters.ts, intelligent-route.ts — lógica de decisão da rota inteligente, Fase 2)
/supabase/migrations
/docs
CLAUDE.md
```

## Como usar este documento com o Programador Pedro

Ao iniciar cada fase, cole o trecho correspondente da fase no Claude Code (ou referencie este arquivo) e peça para ele quebrar em tarefas menores antes de codar. Não avance para a fase seguinte sem o "Definition of done" da fase atual satisfeito.