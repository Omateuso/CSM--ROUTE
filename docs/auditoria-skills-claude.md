# Auditoria de skills/plugins Claude para o projeto

> Levantamento original feito a partir do catálogo de skills pessoais e do marketplace de plugins da organização, visível na sessão Cowork (sem acesso ao ambiente local). Confirmado e corrigido em seguida pelo Programador Pedro (Claude Code, extensão VS Code), com acesso real a `~/.claude/skills`, `~/.claude/settings.json` e à lista de skills habilitadas nesta sessão — ver metodologia no final do documento.

## Resultado por área (confirmado localmente)

| # | Área | Achado original (Cowork) | Confirmado localmente | Classificação final |
|---|---|---|---|---|
| 1 | Next.js / App Router | Nenhum | Nenhuma skill local | **DESNECESSÁRIA** |
| 2 | TypeScript | Nenhum | Nenhuma skill local | **DESNECESSÁRIA** |
| 3 | React | Nenhum | Nenhuma skill local | **DESNECESSÁRIA** |
| 4 | UI/UX / frontend design | Plugin `design` (não instalado) — genérico | **Divergência ↑**: skills de usuário `frontend-design`, `mobile-design`, `ui-a11y`, `ui-review`, `ui-ux-pro-max` — todas disponíveis nesta sessão | **IMPORTANTE** |
| — | (mesma área) `dataviz` | IMPORTANTE condicional ("confirmar se disponível") | **Confirmado disponível** nesta sessão (skill built-in do Claude Code) | **IMPORTANTE** |
| 5 | Tailwind CSS | Nenhum (nativo) | **Divergência ↑**: skill de usuário `tailwind-patterns` (Tailwind v4, design tokens) disponível | **OPCIONAL** |
| 6 | Supabase (geral) | Nenhum (nativo) | **Divergência forte ↑↑**: skill de usuário `supabase` — cobre Database, Auth, Storage, Realtime, Edge Functions, supabase-js/SSR em Next.js, exatamente a stack do projeto | **ESSENCIAL** |
| 7 | PostgreSQL / modelagem de banco | Plugin `data` (não instalado) — genérico | **Divergência ↑**: skill de usuário `supabase-postgres-best-practices`, mais específica que o `data` genérico | **IMPORTANTE** |
| 8 | Autenticação/Autorização/RBAC | Plugin `auth0` (não instalado) — provedor errado | Auth0 confirmado ausente/irrelevante. **Achado novo**: skills de usuário `auth-implementation-patterns` (agnóstica de provedor) e `api-security-best-practices` | **IMPORTANTE** (não mais DESNECESSÁRIA) |
| 9 | Segurança / RLS | Nenhum — "reforçar via item 11 (code-review)" | **Maior divergência ↑↑**: duas skills dedicadas — `cc-skill-security-review` (dispara em auth, upload de arquivo, novo endpoint de API) e `security-review` (built-in, auditoria completa do branch) | **IMPORTANTE** |
| 10 | PWA / mobile-first | Nenhum (nativo) | Manifest/service worker seguem nativos/biblioteca (`next-pwa`). **Divergência parcial**: `mobile-design` cobre o UX mobile-first do perfil técnico | Plumbing PWA: **DESNECESSÁRIA**. UX mobile: **OPCIONAL** (via item 4) |
| 11 | Testes automatizados | Plugin `engineering` (não instalado) — `testing-strategy`, `code-review`, etc. | **Parcial**: sem equivalente a `testing-strategy` localmente. `code-review` e `simplify` são built-in, sempre disponíveis, sem instalação | `code-review`/`simplify`: **IMPORTANTE**. Estratégia de teste formal: **sem skill dedicada — usar via prática nativa** |
| — | (mesma área) `qodo-skills` | OPCIONAL condicional | Não encontrado localmente, sem integração Qodo configurada | **DESNECESSÁRIA** (confirmado) |
| 12 | Mapas / Leaflet / geospatial | Nenhum (nativo) | Nenhuma skill local | **DESNECESSÁRIA** |
| 13 | Algoritmos de roteamento/otimização | Nenhum (nativo) | Nenhuma skill local | **DESNECESSÁRIA** |
| 14 | Supabase Storage / upload de arquivos | Nenhum (nativo) | Coberto pela skill `supabase` (item 6) | Sem skill própria — **coberto pelo item 6** |
| 15 | Supabase Realtime | Nenhum (nativo) | Coberto pela skill `supabase` (item 6) | Sem skill própria — **coberto pelo item 6** |

### Achados novos, fora da lista original do Cowork

| Área | Skill local | Por que é relevante | Classificação |
|---|---|---|---|
| Segurança de API | `api-security-best-practices` | O CLAUDE.md exige que sugestão de rota e cálculo de SLA fiquem no servidor (API route/Edge Function) — auth, validação de input, rate limiting se aplicam diretamente | **IMPORTANTE** |
| Verificação manual de UI | `run` (built-in) | Sobe e testa o app real no navegador; alinhado à própria diretriz de testar antes de reportar concluído | **IMPORTANTE** |
| Meta-ferramentas do Claude Code | `claude-api`, `artifact-design`, `artifact-diagramming`, `artifact-capabilities`, `update-config`, `keybindings-help`, `fewer-permission-prompts`, `loop`, `schedule`, `init` | Existem no ambiente mas são configuração da própria extensão/harness, referência de SDK da Anthropic, ou geração de Artifacts — nenhuma tem uso direto no domínio deste projeto hoje | **DESNECESSÁRIA** (fora de escopo) |

## Recomendação final consolidada (a partir da Fase 1)

**ESSENCIAL:**
- `supabase` — uso contínuo em todas as fases (Auth dos 3 perfis, Storage de evidências, Realtime do painel do gerente, Edge Functions da sugestão de rota).

**IMPORTANTE (uso contínuo desde a Fase 1):**
- `cc-skill-security-review` + `security-review` — RLS, uploads de evidência/OS, novos endpoints de API.
- `supabase-postgres-best-practices` — a cada migration nova além da `0001`.
- `api-security-best-practices` + `auth-implementation-patterns` — setup dos 3 perfis e API routes sensíveis.
- `code-review` (built-in) — revisão contínua de cada funcionalidade entregue.
- `run` (built-in) — validar a tela real no navegador antes de dar uma tarefa por concluída.
- `dataviz` — Fase 1 (dashboard) e Fase 4 (painéis/indicadores).
- `ui-a11y` — badges de prioridade/SLA (cor nunca é único sinal).
- `mobile-design` — perfil técnico mobile-first (Fase 3).

**OPCIONAL (uso pontual):**
- `frontend-design`, `ui-ux-pro-max`, `ui-review`, `tailwind-patterns` — reforço pontual de consistência visual entre as 3 personas.
- `simplify` (built-in) — limpeza pontual pós-feature.

**DESNECESSÁRIA / sem skill dedicada — usar via biblioteca padrão/prática nativa:**
- Next.js, TypeScript, React, Leaflet/Mapbox, algoritmo de roteamento (Haversine + heurística de vizinho mais próximo), plumbing de PWA (manifest/service worker), estratégia formal de testes automatizados.
- `auth0` (provedor diferente do usado aqui), `qodo-skills` (redundante, exige conta própria) — confirmado ausentes e não aplicáveis.

## Metodologia da confirmação local

Verificado pelo Programador Pedro (Claude Code, extensão VS Code) em 2026-08-14:
1. `.claude/skills` a nível de projeto — **não existe** (confirmado; repositório ainda não tem essa estrutura).
2. `~/.claude/skills` a nível de usuário — 11 diretórios de skill instalados: `api-security-best-practices`, `auth-implementation-patterns`, `cc-skill-security-review`, `frontend-design`, `mobile-design`, `supabase`, `supabase-postgres-best-practices`, `tailwind-patterns`, `ui-a11y`, `ui-review`, `ui-ux-pro-max`.
3. `~/.claude/settings.json` — sem marketplace/plugin configurado; nenhuma referência a `dataviz` ou a plugins externos.
4. Skills built-in da própria ferramenta (não vivem em `~/.claude/skills`, vêm empacotadas com o Claude Code e por isso não apareciam na busca do Cowork): `dataviz`, `code-review`, `simplify`, `security-review`, `run`, `init`, `claude-api`, `artifact-design`, `artifact-diagramming`, `artifact-capabilities`, `update-config`, `keybindings-help`, `fewer-permission-prompts`, `loop`, `schedule` — todas confirmadas disponíveis nesta sessão.

Nenhuma skill foi instalada, habilitada ou desabilitada nesta etapa — este documento é só a confirmação/reclassificação solicitada. Nenhum código do projeto foi alterado.
