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
- **Cadastro de RTs**: código, nome, endereço, bairro, região, latitude/longitude, status ativo/inativo.
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

**Objetivo:** permitir que o gerente monte, ajuste e confirme uma rota de atendimento, com sugestão automática baseada em proximidade + volume + criticidade.

### Dados e telas
- **Equipes e técnicos**: cadastro de equipes e vínculo de técnicos (perfil `tecnico`) a uma equipe.
- **Tela "Montar Rota"**: gerente seleciona região → sistema lista RTs da região ordenadas por volume de chamados abertos.
- **Sugestão inteligente de rota**: algoritmo que combina distância geográfica (fórmula de Haversine entre lat/long das RTs) com quantidade de chamados e criticidade — heurística tipo "vizinho mais próximo ponderado", não precisa ser um solver de roteamento complexo na v1. Implementar como função no backend (Edge Function do Supabase ou API route do Next.js) para poder evoluir depois sem mudar o front.
- Gerente pode aceitar a sugestão, remover/adicionar RT, reordenar manualmente, desmarcar tudo.
- **Confirmar Rota do Dia**: persiste `rotas` + `rota_rts` (data, região, equipe, responsável, horário de confirmação).
- **Histórico de rotas**: tela "Rotas Confirmadas", consulta por data/região/equipe.

### Definition of done da Fase 2
- Uma rota confirmada gera registros reais em `rotas`/`rota_rts` e aparece no histórico.
- A sugestão de rota responde em tempo aceitável (< 2s) para uma região com até ~30 RTs.

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
  /(gerente)/rts
  /(gerente)/rotas/montar
  /(gerente)/rotas/confirmadas
  /(gerente)/validacao
  /(tecnico)/servicos-do-dia
  /(tecnico)/servico/[id]
  /(gestao)/painel
  /(gestao)/relatorios
  /api/... (rotas server-side quando precisar de service role ou lógica de sugestão de rota)
/components
/lib/supabase (client.ts, server.ts)
/lib/rotas (algoritmo de sugestão)
/supabase/migrations
/docs
CLAUDE.md
```

## Como usar este documento com o Programador Pedro

Ao iniciar cada fase, cole o trecho correspondente da fase no Claude Code (ou referencie este arquivo) e peça para ele quebrar em tarefas menores antes de codar. Não avance para a fase seguinte sem o "Definition of done" da fase atual satisfeito.