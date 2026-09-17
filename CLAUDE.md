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
- **Google Maps Platform** (a partir da Fase 2) — camada geográfica da rota inteligente (distância real de carro, duração, matriz de distância/tempo). Chave obtida pelo usuário em 16/08. Nunca hardcodar a chave — variável de ambiente + placeholder em `.env.example`. Provavelmente precisa de 2 chaves com restrições diferentes (server-side pras APIs de rota/distância, `NEXT_PUBLIC_...` restrita por domínio se houver mapa interativo no client) — ver detalhe em `docs/plano-de-fases.md` (Fase 2, "Setup específico").
- Deploy sugerido: Vercel

Schema do banco: [`supabase/migrations/0001_init_schema.sql`](supabase/migrations/0001_init_schema.sql). Qualquer mudança de schema deve virar uma nova migration numerada — nunca edite a `0001` depois que ela já tiver sido aplicada em algum ambiente.

## As 3 personas do sistema

1. **Gerente / Responsável Operacional** — monta e confirma rotas, acompanha execução, valida serviços.
2. **Técnico / Executor** — interface mobile simples: vê os serviços do dia, inicia, conclui com foto/observação/OS.
3. **Gestão** — visão macro consolidada, indicadores, relatórios; não executa nem monta rota. **Exceção deliberada:** é quem detém a autoridade sobre o **cadastro de RTs** (criar, editar, trocar endereço) — ver "Permissões de cadastro (CRUD)" abaixo. Fora isso, gestão continua somente-leitura no restante do sistema.

Cada tela deve deixar claro para qual dessas 3 personas ela é. Nunca misture a interface do técnico (deve ser mínima, poucos botões, linguagem direta) com a densidade de informação do painel gerencial.

## Regra de processo — antes de implementar qualquer funcionalidade

> **Não implemente uma funcionalidade diretamente na UI sem antes verificar se o modelo de dados, as permissões (role/RLS) e o fluxo de negócio suportam essa funcionalidade.**
>
> O risco clássico deste projeto é o oposto do que parece produtivo: uma tela bonita e demonstrável, sustentada por um banco que depois dificulta o fluxo real (rota → técnico → execução → evidência → validação → TomTicket). As tabelas `servicos`, `execucoes`, `conclusoes`, `evidencias`, `validacoes`, `rotas` e `rota_rts` já foram desenhadas justamente para sustentar esse fluxo de ponta a ponta — ao propor uma tela nova, confirme primeiro que ela se encaixa nesse modelo (ou proponha a migration necessária, com a policy de RLS junto) **antes** de codar o componente visual.

## Regras de negócio invioláveis (não flexibilizar sem confirmar com o usuário)

- **Prioridade e SLA são camadas independentes.** Um chamado pode ser 🔴 Emergencial e 🟣 SLA vencido ao mesmo tempo — isso deve se destacar visualmente, não ser tratado como "só mais um chamado antigo".
- **"Concluído pelo técnico" ≠ "Finalizado administrativamente".** O pipeline de status de um serviço é sempre: `planejado → em_deslocamento → em_execucao → concluido_tecnico → aguardando_validacao → validado`. Só o gerente, ao validar, fecha o ciclo. Várias funcionalidades futuras (relatórios, indicadores de gargalo, SLA) dependem dessa distinção — nunca colapsar os dois estados em um só por conveniência.
- **A sugestão de rota é auxílio, não obrigação.** O gerente sempre pode remover, adicionar ou reordenar RTs manualmente depois da sugestão automática. Isso vale também para "força-tarefa" (núcleo operacional) — é sempre sugestão, nunca ação automática.
- **Toda recomendação de rota precisa ser explicável.** Nunca mostrar só "RT C recomendada" — sempre mostrar o motivo (distância, chamados, SLA envolvidos). Ver detalhe completo em "Rota inteligente" abaixo.
- **Bonificação/incentivo para técnicos: não implementar.** Pode ser citada em texto como possibilidade futura (Fase 5), mas não crie schema, tela ou lógica para isso a menos que o usuário peça explicitamente.
- **Dados fictícios apenas em exemplos/seeds.** Nunca use dados pessoais reais em massa de teste ou documentação.

## Permissões de cadastro (CRUD)

- **RTs (`rts` e `rt_enderecos`)**: criar RT, editar RT (nome/ativo) e trocar endereço (`fn_trocar_endereco_rt`/`fn_criar_rt_com_endereco`) são ações **exclusivas do perfil `gestao`**. `gerente` e `tecnico` têm somente leitura em `rts`/`rt_enderecos`. **Mudança decidida em ago/2026** (retrofit sobre a `0002`/`0005`, que originalmente davam essa permissão ao `gerente` — ver migration `0006`): quem decide/valida onde uma RT existe e para onde ela se move é a gestão, não o operacional do dia a dia.
- **Zonas/regiões**: permissão **partida ao meio** desde a migration `0013` (17/08/2026) — **criar** zona/região continua exclusivo do `gerente` (tela `app/zonas/`, compartilhada com `gestao` desde que essa migration saiu); **renomear/excluir** passou a ser exclusivo da **`gestao`**, mesmo raciocínio da migration `0006` pras RTs (quem valida a estrutura territorial "oficial" não é o operacional do dia a dia). `tecnico` continua só leitura.
- **Chamados**: permissão de INSERT/UPDATE no banco liberada tanto pra `gerente` quanto pra `gestao` (migrations `0002` e `0009`) — mas a **UI só oferece criar** (`app/chamados/`, botão "+ Novo chamado" habilitado só pra `gestao`; pro `gerente` fica visível e desabilitado, ver "Estado atual" B3). **Editar não existe mais em nenhuma tela** (removido em 17/08/2026, ver "Estado atual" B3) — clicar num chamado abre um modal só de leitura (assunto, mensagem, prioridade, SLA, status); a policy de UPDATE continua no banco, sem uso por ora, porque editar prioridade/status por aqui deixou de fazer sentido depois que ficou claro que quem resolve o chamado de verdade é o TomTicket, não este sistema. `tecnico` só leitura.

Nenhuma tela deve oferecer botão de criar/editar/trocar endereço de RT para `gerente` ou `tecnico`; nem botão de renomear/excluir zona/região para `gerente` ou `tecnico`; nem botão de criar zona/região para `gestao` ou `tecnico`.

Convenção: a permissão é sempre garantida na **RLS** (policy da tabela), nunca só escondendo o botão na UI — esconder o botão é UX, a RLS é quem impede de fato uma chamada direta à API/RPC.

Convenção do projeto Supabase (dashboard): "Automatically expose new tables" fica **desligado** e "Enable automatic RLS" fica **ligado** na criação do projeto — toda tabela nova nasce sem acesso via API até a policy ser criada explicitamente na mesma migration que cria a tabela. Nunca depender do padrão do dashboard para uma tabela ficar acessível.

## Endereço de RT tem histórico — nunca sobrescrever sem registrar

O número/código de uma RT (`codigo`) é permanente; o endereço **não é** — residências mudam de imóvel ao longo do tempo (o projeto começou em dez/2023 e isso já aconteceu várias vezes). `chamados.rt_id` aponta para a RT (identidade permanente), nunca para um endereço específico — isso já está certo no schema e é o que garante que o histórico de chamados de uma RT não se perde quando ela muda de endereço.

O que isso implica na prática:

- **Nunca criar uma nova linha em `rts` porque o endereço mudou.** Isso fragmentaria o histórico de chamados entre a RT "antiga" e a "nova", quando na verdade é a mesma RT.
- Toda mudança de endereço passa pela tabela `rt_enderecos` (histórico completo, ver migration `0005`) usando a função `fn_trocar_endereco_rt(...)` — ela fecha o endereço vigente, abre o novo e atualiza os campos denormalizados em `rts` (que continuam existindo para não quebrar as telas de Fase 1/mapa/dashboard) em uma única transação.
- A tela de cadastro/edição de RT (Fase 1) precisa ter dois fluxos distintos: **editar dados da RT** (nome, ativo) vs. **trocar endereço** (chama a função acima, não um UPDATE direto nas colunas de endereço/lat/long).
- TomTicket: se o campo de RT lá for editado in-place quando o endereço muda, uma busca avançada pode ou não trazer os chamados antigos junto — isso depende de como o TomTicket indexa esse campo (por ID interno ou por texto). É uma pergunta para o suporte do TomTicket, não algo que resolvemos aqui. Nosso sistema já não tem esse problema porque `chamados.rt_id` é estável independente do endereço.

## Rota inteligente — regras de arquitetura (Fase 2, ajuste 16/08/2026)

Especificação completa em `docs/plano-de-fases.md` (Fase 2, Parte B). Regras que não podem ser flexibilizadas sem confirmar com o usuário:

- **Google decide geografia, o sistema decide operação.** O Google Maps Platform fornece distância/tempo/trânsito reais. Quem pontua e recomenda qual RT visitar é o nosso algoritmo (`/lib/routing`), combinando isso com chamados/prioridade/SLA/concentração. O Google nunca escolhe a RT sozinho.
- **Raio de proximidade é configuração, não número mágico espalhado no código.** Constante centralizada (`ROUTE_PROXIMITY_RADIUS_KM`, valor inicial 5 km) — precisa dar pra mudar sem caçar hardcode.
- **Região é filtro, não parede.** RT de região vizinha pode aparecer como candidata se estiver geograficamente próxima e vantajosa — nunca bloquear automaticamente por região.
- **A referência de proximidade muda a cada RT escolhida.** Sempre recalcular a partir da última RT selecionada, nunca ficar preso na primeira.
- **Separação de responsabilidade obrigatória:** `/lib/maps/google/` (integração Google — routes/matrix/geocoding) fica separado de `/lib/routing/` (pontuação e decisão — proximity/score/clusters/intelligent-route). Lógica sensível sempre no backend (API Route ou equivalente server-side), nunca no client.
- **Custo/performance: filtrar antes de consultar o Google.** Reduzir candidatas por proximidade geográfica local primeiro (grátis), só depois chamar a API paga (rota/tempo) para o conjunto já reduzido. Meta: sugestão em < 2s para até ~30 RTs.
- **Núcleo operacional e força-tarefa são conceitos novos** (RTs muito próximas geograficamente, ex.: mesmo condomínio) — o sistema pode reconhecer e sugerir atender em conjunto, mas é sempre sugestão (ver "Regras de negócio invioláveis" acima).
- **Não antecipar Fase 3 dentro da Parte B** — nada de iniciar/concluir serviço, foto de OS, evidência, validação ou painel de execução em tempo real nesta parte. Só preparar a estrutura (rota confirmada persistida) pra Fase 3 consumir depois.

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

**Fase 2 (rota inteligente):** a especificação do usuário (16/08) pede também uma skill `google-maps-platform`. Ela **ainda não está documentada** em `docs/guia-skills-design.md` nem confirmada como disponível no seu ambiente — antes de assumir que existe, verifique (`/skills` ou equivalente) e avise o usuário se não encontrar, em vez de simular o comportamento dela.

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

> Histórico completo e detalhado de cada sessão (o que foi pedido, decidido, testado, e por quê) está em [`docs/historico-implementacao.md`](docs/historico-implementacao.md) — consulte lá quando precisar de precedente ou do raciocínio por trás de uma decisão antiga. Esta seção é só um índice: status por fase + o que ainda está pendente de ação (migration não rodada, teste não feito). Movido pra cá em 17/09/2026 porque o histórico tinha crescido pra ~90 mil tokens e virou o maior custo fixo de cada mensagem, sendo reenviado por inteiro a cada turno — mantenha esta seção enxuta, e jogue o detalhe novo pro arquivo de histórico, não aqui.

**Ao terminar uma sessão:** adicione o detalhe completo no topo do "Trabalho recente" do `docs/historico-implementacao.md` (mesmo estilo de sempre — o que foi pedido, decidido, testado), e atualize só a linha correspondente aqui (ou adicione uma nova) e a lista de pendências abaixo.

### Fases (`docs/plano-de-fases.md`)

- [x] Fase 1 — Base Operacional (concluída 16/08/2026)
- [x] Fase 2 — Rotas, incl. Rota Inteligente (concluída 17/08/2026)
- [x] Fase 3 — Execução em campo, técnico (concluída 18/08/2026)
- [x] Fase 4 — Gestão: Validação, Dashboard/Painel em tempo real, Relatório diário, Histórico do chamado (concluída 19/08/2026)
- [x] Auditoria de segurança pós-validação — fotos obrigatórias+geo, hash de OS, recusar/pendência (21/08/2026)
- [x] Auditoria e redesign global de interfaces — componentes compartilhados, Dashboard, navegação (23-26/08/2026; Painel/Mapa/Detalhe do técnico da Etapa 4 do plano original nunca foram retomados — ver histórico)
- [ ] Fase 5 — Evoluções Futuras (não iniciada)

### Trabalho fora da sequência de fases, mais recente primeiro

Cada linha é um evento de sessão — ver `docs/historico-implementacao.md` pelo título/data pra ler o detalhe completo.

- [x] Localização das RTs: endereço oficial (rua/número/CEP) vira a fonte de verdade da navegação, geocodificação Nominatim, backfill das 98 RTs, correção de coordenadas erradas — 16-17/09/2026
- [x] Backup dos dados de localização das RTs (limpeza cogitada, cancelada) — 16/09/2026
- [x] Status `em_revisao` + 3ª opção de despacho na Central de Urgências ("otimizar pra rota atual") + localização estimada do técnico — 15-16/09/2026, com 4 bugs reais corrigidos na sequência (RLS de evidências em revisão, chave de mapa duplicada, distância de despacho por atividade real, `fimDeRota` ignorando paradas concluídas, ORS estourando cota, unicidade de `rota_rts`)
- [x] Compressão de foto (bug de memória) + botão "Tire uma foto" — 15/09/2026
- [~] "Abrir rota no Google Maps" caindo pra ordem planejada — investigado, 2 melhorias aplicadas, causa raiz não 100% confirmada — 15/09/2026
- [x] 4 pedidos avulsos: compressão de foto na câmera, rota otimizada por tempo real, botão de áudio estilo WhatsApp, botões Iniciar/Concluir padronizados em verde — 15/09/2026
- [x] Ícone de instalação PWA/favicon real + 2 bugs cross-cutting (modal estourando em tela estreita, barra de navegação mobile) — 15/09/2026
- [x] Áudio do relato (além da transcrição) no atendimento/revisão — 15/09/2026
- [x] Repositório espelhado no GitHub + deploy Netlify configurado — 14/09/2026
- [x] Mais de um técnico por RT + resposta de "revisão" no TomTicket + navegação mobile no topo — 14/09/2026
- [x] Fluxo leve de revisão (iniciar/concluir sem foto antes/depois) + transcrição por voz + Realtime em mais telas — 14/09/2026
- [x] Categoria do serviço "concluir hoje" vs "revisão técnica" no checklist de Montar Rota — 14/09/2026
- [x] Caça a bugs pós-Central de Urgências (hidratação, toast, busca com vírgula, reconciliação cancelando chamados fictícios) — 11/09/2026
- [x] Central de Urgências redesenhada pro modelo "chamado primeiro" — 11/09/2026
- [x] Menu-pasta trocado por menu lateral retrátil (estado final da navegação) — 10/09/2026
- [x] "Rota do dia" (mapa ao vivo com GPS do técnico) removida por decisão de privacidade; navegação do técnico no Google Maps preservada — 10/09/2026
- [x] Google Maps substituído por Leaflet + OpenRouteService (traçado real, navegação do técnico) — 10/09/2026
- [x] 8 + 5 ajustes de uso real (lightbox de anexo, toast de resposta nova, busca no painel do técnico, reagendamento em Pendências, resposta do gerente ao cliente, reconciliação de chamados excluídos) — 10/09/2026
- [x] `loading.tsx` em todas as rotas (navegação para de travar na troca de tela) — 09/09/2026
- [x] Evolução pra plataforma operacional, Fases 0-6 (reexecução visível, histórico de endereço da RT, respostas do cliente + sino, avaliação prévia do serviço, redesign de Pendências/Validação) — 09/09/2026
- [x] Organização do repositório + medição de desempenho + merge com o relatório mensal — 09/09/2026
- [x] Gerente escolhe quais chamados o técnico cumpre + painel do técnico por dia + reset de dados — 08/09/2026
- [x] Coleta direta do TomTicket (substitui import por planilha) + sincronização automática a cada 5 min + finalizar chamado — 08/09/2026
- [x] Corrigir rota confirmada errada (cancelar rota, trocar técnico da parada) — 08/09/2026
- [ ] Responder chamado no TomTicket direto do sistema — código completo, status de migration incerto (ver pendências abaixo)
- [x] Relatório mensal da CSM (ANEXO 1 + documento de evidências, `.xlsx`+`.docx`) — 08/09/2026
- [x] Central de Urgências, primeira versão — 04/09/2026 (depois substituída pelo redesenho "chamado primeiro" de 11/09)
- [x] Relatório com timbrado sob demanda (catálogo de blocos, depois virou download de PDF direto) — 27-28/08/2026
- [x] Raio de proximidade configurável (select → glassmorphism → modal) + paleta unificada `#008A83` — 27/08/2026
- [x] Bugs de conclusão de atendimento (compressão, OS obrigatória) + selo de OS reaproveitada assimétrico — 27/08/2026
- [x] Navegação: cápsula deslizando → geometria de pasta → menu-pasta real (26/08/2026, depois substituído em 10/09)
- [x] Tela de login redesenhada (versão escura) — 25/08/2026
- [x] Reset de dados operacionais + selo de localização verde/vermelho — 25/08/2026
- [x] Componentes compartilhados + Dashboard redesenhado + navegação pill bar (Etapas 1-4 da auditoria de interfaces) — 23-24/08/2026
- [x] "Recusar" virou Pendência (categorizada) + Pendências virou página própria — 21-22/08/2026
- [x] Auditoria de segurança pós-validação — Pacotes 1 e 2 (fotos+geo, hash de OS) — 21/08/2026

### Pendências ativas — conferir/agir antes de assumir que algo funciona

**Migrations com último status conhecido "ainda não rodada" pelo usuário** (a lista de migrations aplicadas muda a cada sessão — antes de confiar nesta lista, prefira checar ao vivo: chamar a função com um id inexistente e ver se o erro é "de negócio" ou "função não existe", método já usado várias vezes porque o cache do PostgREST dá falso-negativo pra `{}`):
- `0028_resposta_tomticket.sql` — status incerto (marcada pendente em 08/09, mas funcionalidade relacionada foi expandida depois como se estivesse ativa; confirmar antes de assumir qualquer lado)
- `0045_urgencias_chamado_first.sql` — confirmada aplicada em 11/09 (registrada aqui só pra não confundir com as pendentes abaixo)
- `0047_revisar_servico.sql`, `0048_realtime_mais_telas.sql`, `0050_multiplos_tecnicos_por_rt.sql`, `0051_evidencia_audio.sql`, `0052_aumentar_limite_evidencias.sql` — sem confirmação de execução no histórico
- `0061_urgencia_rt_ja_na_rota.sql` — usuário ainda precisa rodar (renumerada de 0059 em 17/09/2026 por colisão com `0059_relatorios_rt.sql`, do Mateus, mergeado do Gitea nessa mesma sessão)
- `0053`-`0058`, `0060` — confirmadas aplicadas (15-16/09)

**Outras pendências:**
- `ORS_API_KEY` só está em `.env.local` (dev) — falta colar no ambiente de produção (Netlify) pra rota inteligente/navegação usarem tempo real de carro em vez de linha reta
- Deploy Netlify: `netlify login` e as variáveis de ambiente do site ainda precisam ser configuradas pelo usuário (não consigo autenticar por aqui); 2 secrets do GitHub Actions (`SYNC_URL`, `SYNC_SECRET`) pendentes pra sincronização automática funcionar em produção
- SRT 63/64/65/66: CEP ficou `NULL` de propósito (via real "Rua Projetada 04" não existe na base dos Correios) — navegação usa a coordenada, que está verificada; se o usuário confirmar o CEP certo depois, preencher
- Logo CSM em alta resolução + endereço/CNPJ/selos institucionais pro relatório mensal — placeholders `[PREENCHER]` em `lib/relatorio-mensal/csm.ts`
- "Abrir rota no Google Maps" caindo pra ordem planejada em vez da otimizada — causa raiz não 100% confirmada (ver entrada de 15/09 no histórico)

## Como trabalhar comigo (Programador Pedro)

- Ao começar uma fase nova, releia o trecho correspondente em `docs/plano-de-fases.md` e proponha um plano de tarefas pequenas antes de escrever código.
- Não pule fase — a Fase 3 depende de rotas existirem (Fase 2), a Fase 4 depende de execução real acontecendo (Fase 3).
- Se uma decisão de produto não estiver clara no plano (ex.: regra de SLA específica, layout de uma tela), pergunte antes de assumir.
- Antes de codar uma tela nova, declare explicitamente quais tabelas/colunas/policies de RLS ela usa. Se algo não existir no schema atual, proponha a migration primeiro — nunca construa a UI sobre uma estrutura de dados que ainda não existe "de mentirinha".
- Releia também `docs/atualizacoes-futuras.md` no começo de cada sessão nova. É onde o usuário vai registrando ideias/funcionalidades futuras que ainda **não** são pra implementar agora — sirva só de contexto, não vire tarefa sem o usuário pedir explicitamente.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
