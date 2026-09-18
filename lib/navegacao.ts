import type { PontoGeografico } from "@/lib/routing/proximity";

// Navegação do técnico: abre a rota no app de mapa DELE (Google Maps ou
// Waze), em vez de embutir turn-by-turn no PWA.
//
// Por quê: são URLs universais — no celular abrem o app nativo, no desktop
// o site. Não custam requisição de API nenhuma, não gastam cota do provedor
// de rotas, e entregam navegação de verdade (voz, trânsito, recálculo) com
// o app que o técnico já conhece. Reimplementar isso dentro do PWA seria
// pior e mais caro.
//
// ⚠️ DESTINO É ENDEREÇO EM TEXTO, NÃO COORDENADA — mudança de 16/09/2026,
// a partir de um caso real relatado pelo usuário: a SRT 3 fica na Rua
// Pernambuco 780, mas abrir a rota do técnico levava ao "Rua Pernambuco
// 625". Motivo: mandando `destination=lat,lng`, o Google mostra o endereço
// que ELE considera mais próximo daquele ponto — e a coordenada salva era
// de nível de rua, não da porta. Mandando o endereço em texto (logradouro,
// número, bairro, cidade/UF e CEP), quem resolve a posição é o
// geocodificador do Google, que tem numeração de casa do Rio indexada
// (o OpenStreetMap, que usamos internamente, não tem — daí o problema
// nunca se resolver por lá).
//
// Isso é segurança operacional, não refinamento: técnico parando na casa
// errada afeta moradores de verdade. A coordenada continua existindo e
// sendo usada pro mapa interno, matriz de distância e ordenação de rota —
// só deixou de ser o que vai no link de navegação.
//
// Referência: Google Maps URLs (api=1). Waze só aceita um destino, então
// serve pra "ir para esta RT", nunca pra rota do dia inteira.

/** O Maps URLs API aceita no máximo 9 pontos intermediários. */
const MAX_WAYPOINTS = 9;

/** Tudo opcional: RT antiga pode não ter endereço estruturado ainda. */
export type EnderecoNavegacao = {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  /** Texto livre do cadastro (`rts.endereco`) — usado quando não há logradouro estruturado. */
  enderecoLivre?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/**
 * Monta o endereço no formato que os geocodificadores brasileiros leem
 * melhor: "Rua Pernambuco, 780 - Engenho de Dentro, Rio de Janeiro - RJ,
 * 20730-030". O CEP entra sempre que existe: é o que impede o Google de
 * casar com uma rua de mesmo nome em outro bairro/município.
 */
export function textoEnderecoNavegacao(e: EnderecoNavegacao): string | null {
  const ruaNumero = e.logradouro?.trim()
    ? [e.logradouro.trim(), e.numero?.trim()].filter(Boolean).join(", ")
    : (e.enderecoLivre?.trim() || null);
  if (!ruaNumero) return null;

  const partes = [ruaNumero];
  if (e.bairro?.trim()) partes.push(e.bairro.trim());
  const cidadeUf = [e.cidade?.trim(), e.uf?.trim()].filter(Boolean).join(" - ");
  if (cidadeUf) partes.push(cidadeUf);
  if (e.cep?.trim()) partes.push(e.cep.trim());
  return partes.join(", ");
}

/**
 * O que vai no `destination`/`waypoints` da URL.
 *
 * Regra: **o endereço em texto só é confiável quando tem CEP.** Sem CEP, um
 * nome de rua sozinho pode existir em dezenas de lugares da mesma cidade —
 * achado real (16/09/2026): existem **50 "Rua Projetada" no Rio de Janeiro**,
 * e as SRT 63-66 (Colônia Juliano Moreira, Jacarepaguá) vinham com o CEP de
 * uma delas que fica no Jacaré, a ~25km. Nesse caso a coordenada cadastrada
 * é o dado mais forte, e é ela que vai.
 *
 * Com CEP, o inverso: o texto vence a coordenada, porque a coordenada é
 * aproximada (nível de rua) e faz o Google mostrar a casa vizinha — foi
 * exatamente o problema da SRT 3 (780 abrindo como 625).
 */
export function alvoNavegacao(e: EnderecoNavegacao): string | null {
  return escolherAlvo(e)?.valor ?? null;
}

function escolherAlvo(e: EnderecoNavegacao): { valor: string; tipo: "endereco" | "coordenada" } | null {
  const texto = textoEnderecoNavegacao(e);
  const coordenada = e.lat != null && e.lng != null ? `${e.lat},${e.lng}` : null;

  if (texto && e.cep?.trim()) return { valor: texto, tipo: "endereco" };
  if (coordenada) return { valor: coordenada, tipo: "coordenada" };
  if (texto) return { valor: texto, tipo: "endereco" };
  return null;
}

/** Navegação até um ponto único, saindo de onde o técnico estiver. */
export function linkGoogleMapsDestino(destino: EnderecoNavegacao): string | null {
  const alvo = alvoNavegacao(destino);
  if (!alvo) return null;

  const q = new URLSearchParams({ api: "1", destination: alvo, travelmode: "driving" });
  return `https://www.google.com/maps/dir/?${q}`;
}

/**
 * Waze: `q` aceita endereço em texto (mesma lógica do Google). `ll` só
 * entra quando não há endereço, porque ali o Waze também cairia no
 * "endereço mais próximo do ponto", que é justamente o problema.
 */
export function linkWaze(destino: EnderecoNavegacao): string | null {
  const alvo = escolherAlvo(destino);
  if (!alvo) return null;
  return alvo.tipo === "endereco"
    ? `https://waze.com/ul?q=${encodeURIComponent(alvo.valor)}&navigate=yes`
    : `https://waze.com/ul?ll=${alvo.valor}&navigate=yes`;
}

/**
 * Apple Maps (só faz sentido no iPhone/iPad): universal link que SEMPRE abre
 * o app nativo — nunca cai na App Store, diferente do Google Maps quando o
 * app não está instalado. Mesma escolha de alvo (endereço com CEP > coordenada).
 */
export function linkAppleMapsDestino(destino: EnderecoNavegacao): string | null {
  const alvo = alvoNavegacao(destino);
  if (!alvo) return null;
  const q = new URLSearchParams({ daddr: alvo, dirflg: "d" });
  return `https://maps.apple.com/?${q}`;
}

/** Rota inteira no Apple Maps: paradas encadeadas com `+to:` (limite prático de ~15). */
export function linkAppleMapsRota(paradas: EnderecoNavegacao[]): string | null {
  const alvos = paradas.map(alvoNavegacao).filter((a): a is string => a != null);
  if (alvos.length === 0) return null;
  const usadas = alvos.slice(0, MAX_WAYPOINTS + 1);
  // `+to:` é sintaxe do Apple Maps, não pode ser escapado — só cada alvo.
  const daddr = usadas.map((a) => encodeURIComponent(a)).join("+to:");
  return `https://maps.apple.com/?daddr=${daddr}&dirflg=d`;
}

export type RotaNavegacao = {
  /** Quantas paradas o link realmente cobre (o Google corta em 9 intermediárias). */
  paradasNoLink: number;
  truncada: boolean;
  url: string;
};

/**
 * Rota do dia inteira no Google Maps: a origem fica em aberto (o app usa a
 * posição atual do técnico), as paradas intermediárias viram `waypoints` na
 * ordem da rota, e a última vira o destino. Cada ponto vai como endereço em
 * texto, pelo mesmo motivo do destino único.
 */
export function linkGoogleMapsRota(paradas: EnderecoNavegacao[]): RotaNavegacao | null {
  const alvos = paradas.map(alvoNavegacao).filter((a): a is string => a != null);
  if (alvos.length === 0) return null;

  const destino = alvos[alvos.length - 1];
  const intermediarias = alvos.slice(0, -1);
  const truncada = intermediarias.length > MAX_WAYPOINTS;
  // Corta as ÚLTIMAS intermediárias, não as primeiras: o técnico começa
  // pelo início da rota, então é o começo que precisa estar no link.
  const usadas = truncada ? intermediarias.slice(0, MAX_WAYPOINTS) : intermediarias;

  const q = new URLSearchParams({ api: "1", destination: destino, travelmode: "driving" });
  if (usadas.length > 0) q.set("waypoints", usadas.join("|"));

  return {
    url: `https://www.google.com/maps/dir/?${q}`,
    paradasNoLink: usadas.length + 1,
    truncada,
  };
}

/**
 * Remove paradas sem alvo navegável e repetição consecutiva do mesmo lugar.
 * A comparação é pelo alvo final (endereço em texto), não pela coordenada:
 * duas RTs do mesmo condomínio compartilham a coordenada mas têm endereços
 * diferentes (casa 01, casa 02) — e são paradas diferentes de verdade.
 */
export function paradasNavegaveis<T extends EnderecoNavegacao>(paradas: T[]): EnderecoNavegacao[] {
  const pontos: EnderecoNavegacao[] = [];
  let ultimoAlvo: string | null = null;
  for (const p of paradas) {
    const alvo = alvoNavegacao(p);
    if (!alvo) continue;
    if (alvo === ultimoAlvo) continue;
    pontos.push(p);
    ultimoAlvo = alvo;
  }
  return pontos;
}

/** Coordenadas das paradas — pro mapa interno e pro cálculo de ordem. */
export function coordenadasDe(paradas: EnderecoNavegacao[]): PontoGeografico[] {
  return paradas
    .filter((p): p is EnderecoNavegacao & { lat: number; lng: number } => p.lat != null && p.lng != null)
    .map((p) => ({ lat: p.lat, lng: p.lng }));
}
