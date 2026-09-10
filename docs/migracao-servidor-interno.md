# Migração do Supabase para servidor interno

Registro do que exatamente muda quando o sistema sair do Supabase e dos
serviços gratuitos de terceiros para infraestrutura própria. Escrito em
10/09/2026, junto com a troca do Google Maps por Leaflet/OpenRouteService —
o objetivo daquele trabalho foi deixar cada dependência externa atrás de um
adaptador, para que a migração seja trocar peça, não reescrever tela.

**Nada aqui está pendente.** É documentação do caminho, não uma lista de
tarefas em aberto.

## As três dependências externas, e onde cada uma é trocada

| O quê | Hoje | Ponto único de troca |
|---|---|---|
| Cálculo de rota (distância, tempo, traçado) | OpenRouteService, chave gratuita | `lib/maps/provedor.ts` |
| Tiles do mapa | OpenStreetMap público | `lib/ui/mapa/config.ts` |
| Tempo real | Supabase Realtime | `lib/realtime/index.ts` |

Nenhuma tela importa serviço externo direto. Se algum dia alguém precisar
mudar isso em mais de um arquivo, a abstração foi furada em algum lugar.

## 1. Rotas: OpenRouteService → OSRM próprio

O adaptador de OSRM **já existe e já foi testado** (`lib/maps/osrm/cliente.ts`).
A migração é de infraestrutura, não de código:

1. Subir um container OSRM com o extrato do OpenStreetMap da região
   metropolitana do Rio.
2. `ROTAS_PROVEDOR=osrm` e `OSRM_BASE_URL=http://<host>:5000`.

Ganho: acaba o teto de 2.500 requisições/dia e a dependência de um terceiro.

> **Atenção:** `OSRM_BASE_URL` vazio aponta para `router.project-osrm.org`,
> que é o servidor de demonstração — 1 requisição por segundo, sem garantia
> de disponibilidade, e **uso em produção é vedado pela política deles**.
> Serve para teste. Em produção, sempre apontar para o container próprio.

## 2. Tiles: OpenStreetMap público → próprio

A política do OSM é explícita: não há SLA, o acesso a uso comercial pode ser
retirado a qualquer momento, e quem faz uso pesado deve hospedar os próprios
tiles. Para o volume atual (poucos gerentes) está adequado, mas o dia em que
não estiver, a troca é:

- `NEXT_PUBLIC_TILES_URL` e `NEXT_PUBLIC_TILES_ATRIBUICAO`.

Alternativas antes de hospedar: CARTO, MapTiler ou Stadia, todas com camada
gratuita e URL no mesmo formato `{z}/{x}/{y}`. A atribuição é obrigatória em
qualquer caso — é ela que o `TileLayer` renderiza no canto do mapa.

## 3. Tempo real: Supabase Realtime → Socket.io

Este é o único que exige escrever código novo, e o contrato já está pronto.

O que existe hoje:

- `lib/realtime/tipos.ts` — o contrato (`AdaptadorRealtime`).
- `lib/realtime/supabase-adapter.ts` — a implementação atual.
- `lib/realtime/use-realtime.ts` — o hook que as telas usam.
- `lib/realtime/index.ts` — escolhe qual adaptador está ativo.

Para migrar, escrever `lib/realtime/socketio-adapter.ts` cumprindo a mesma
interface e trocá-lo em `adaptadorRealtime()`. As três telas que consomem
tempo real (`dashboard-realtime.tsx`, `rota-hoje-realtime.tsx`, o sino em
`app-nav.tsx`) **não mudam**.

O contrato é de propósito pobre — "alguma coisa mudou nestas tabelas, vá
buscar de novo". Nenhuma tela usa o payload do evento: todas chamam
`router.refresh()` e deixam o Server Component refazer a consulta. Um
contrato que entregasse a linha alterada amarraria o formato do Postgres a
qualquer transporte futuro sem necessidade.

**Por que Socket.io não foi implementado agora:** ele exige um processo Node
vivo entre requisições, e a Vercel (o deploy previsto, item A8) é
serverless — não hospeda WebSocket persistente. Só faz sentido quando o
servidor interno existir. Até lá seria um segundo servidor rodando para
substituir algo que já funciona.

### O detalhe que não pode se perder na migração

O adaptador do Supabase carrega um achado que custou uma sessão inteira de
depuração (19/08/2026): o client do `@supabase/ssr` não garante que o token
da sessão esteja no socket no momento em que o canal assina. Sem
`realtime.setAuth()` antes do `subscribe()`, a assinatura chega a
`SUBSCRIBED` e a checagem de RLS falha **em silêncio** — nenhum evento
chega e nenhum erro aparece.

Um adaptador de Socket.io terá o seu equivalente: autenticar o socket
**antes** de entrar nos canais, e reautenticar quando o token renovar. Se o
tempo real "conectar mas não receber nada", é aqui que se olha primeiro.

## O que a migração NÃO precisa tocar

- Nenhuma tela (`app/**`).
- A lógica de roteirização (`lib/routing/**`) — ela fala com o contrato do
  provedor, nunca com ORS ou OSRM.
- Os componentes de mapa (`lib/ui/mapa/**`) — não conhecem a URL do tile.
- As migrations. O schema é Postgres puro; o que muda é onde o Postgres roda.

## Degradação: o sistema não pode cair junto com um terceiro

Todo consumidor do provedor de rotas trata falha caindo para distância em
linha reta (Haversine), que não depende de rede:

- `lib/routing/intelligent-route.ts` — a sugestão de rota continua, sem tempo de carro.
- `lib/routing/urgencia-impacto.ts` — idem, para o impacto de uma urgência.
- `lib/maps/tracado-rota.ts` — sem traçado, o mapa mostra só as paradas.

Isso foi verificado nos dois sentidos em 10/09/2026: com provedor ativo, as
20 candidatas vieram com tempo de carro; sem chave configurada, as mesmas 20
vieram por Haversine e nenhuma tela quebrou.
