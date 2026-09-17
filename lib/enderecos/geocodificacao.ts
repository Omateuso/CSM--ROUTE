import { criarLimitador } from "@/lib/limitador";

// Geocodificação de endereço → coordenada, via Nominatim (OpenStreetMap) —
// gratuito, sem chave, SEM cota diária (diferente do ORS, que é 2.500
// req/dia e é compartilhado com a rota inteligente/matriz de distância em
// produção — usar o mesmo provedor pra geocodificação de cadastro
// competiria pela mesma cota). Só rate-limit de 1 req/s (política de uso
// do Nominatim), o que já é o suficiente pra um fluxo de baixo volume
// (cadastro/troca de endereço, acionado manualmente pela gestão).
//
// Trocado de ORS Geocoding (Pelias) pra Nominatim em 16/09/2026, depois de
// esgotar a cota do ORS num teste real e descobrir, testando ao vivo, que
// o Pelias sem uma restrição geográfica forte pode casar o nome de uma rua
// com uma via homônima em OUTRO ESTADO (achado real: 7 RTs teriam ido pra
// Porto Alegre/Curitiba/interior do Piauí/Amazonas com confiança "1.00").
// O Nominatim, com busca ESTRUTURADA (campos separados: street/city/state,
// não um texto único) + `viewbox`+`bounded=1` travando no estado do RJ,
// devolveu resultado correto nos mesmos casos nos testes ao vivo desta
// sessão. Por quê estruturada e não um texto único: testado ao vivo que
// incluir o bairro dentro de um texto livre junto com `bounded=1` fazia o
// Nominatim devolver ZERO resultados (o parser de texto livre não separa
// bem "rua, bairro, cidade" quando restrito geograficamente) — campos
// estruturados não têm essa ambiguidade.
//
// Já existe precedente deste mesmo provedor neste projeto:
// scripts/diagnostico-coordenadas-rts.mjs (auditoria de 15/09/2026) já usa
// Nominatim com sucesso pra esse mesmo tipo de conferência.
//
// Nominatim exige um User-Agent que identifique a aplicação (política de
// uso) — sem email pessoal do usuário embutido no código (não é uma
// informação que deva viajar em toda requisição a um serviço de
// terceiros por padrão).
//
// ⚠️ NÃO mandar `Accept-Language` aqui. Testado ao vivo em 16/09/2026:
// o MESMO request com `Accept-Language: pt-BR` devolve um resultado
// DIFERENTE (e errado) — "Rua Joaquim Soares" com o header vinha em
// Niterói; sem o header vem em Piedade/Rio, que é a correta. O header
// não muda só o idioma do nome devolvido, mexe no ranking.

const BASE = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "CSM-ROUTE-Sistema-Gestao-Operacional/1.0";
const limitador = criarLimitador(1);

function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Bounding box do estado do Rio de Janeiro (com folga) — hard filter via
// `bounded=1`, não só uma dica de proximidade. Sem isso, o Nominatim pode
// devolver um resultado em outro estado (mesmo risco que o ORS mostrou).
const RJ_BBOX = { minLon: -44.9, minLat: -23.4, maxLon: -40.9, maxLat: -20.7 };

export type ResultadoGeocodificacao = {
  lat: number;
  lng: number;
  /** Texto que o Nominatim entendeu ter encontrado — útil pro usuário conferir "é isso mesmo?". */
  label: string;
  /** 0 a 1, heurística própria (Nominatim não calibra confiança como o Pelias — ver confiancaBoa). */
  confianca: number;
  /** "exato" (achou o número da casa) | "aproximado" (só a rua) | "fallback" (só bairro/região). */
  matchType: string;
  /** Município que o OSM atribuiu ao ponto — já validado contra o do ViaCEP antes de chegar aqui. */
  cidadeGeocodificada: string | null;
  /** Bairro que o OSM atribuiu ao ponto — idem. */
  bairroGeocodificado: string | null;
};

/**
 * Confiança "boa o bastante pra aceitar sem alarde" — limiar de partida,
 * ajustável. Abaixo disso (ou sem resultado nenhum) a UI deve avisar e
 * oferecer o caminho manual, nunca aceitar em silêncio (seção 4 do
 * documento do usuário). Na prática, a maioria dos endereços do Rio no
 * OSM não tem numeração de casa indexada (confirmado testando ao vivo) —
 * então a maior parte cai em "aproximado", exigindo confirmação manual, o
 * que é o comportamento correto (nunca aceitar automaticamente uma
 * coordenada de nível de rua como se fosse exata).
 */
export const CONFIANCA_MINIMA_BOA = 0.7;
const MATCH_TYPES_FRACOS = new Set(["fallback"]);

export function confiancaBoa(r: ResultadoGeocodificacao): boolean {
  return r.confianca >= CONFIANCA_MINIMA_BOA && !MATCH_TYPES_FRACOS.has(r.matchType);
}

type ParametrosEndereco = {
  logradouro: string;
  numero?: string;
  bairro?: string;
  cidade: string;
  uf: string;
  cep?: string;
};

type FeatureNominatim = {
  lat: string;
  lon: string;
  display_name: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
};

const bairroDe = (f: FeatureNominatim) =>
  f.address?.suburb ?? f.address?.city_district ?? f.address?.neighbourhood ?? "";
const cidadeDe = (f: FeatureNominatim) => f.address?.city ?? f.address?.town ?? f.address?.municipality ?? "";

async function buscarCandidatos(street: string, cidade: string, uf: string): Promise<FeatureNominatim[]> {
  await limitador.aguardarVez();

  const params = new URLSearchParams({
    street,
    city: cidade,
    state: uf,
    country: "Brasil",
    format: "jsonv2",
    addressdetails: "1",
    countrycodes: "br",
    viewbox: `${RJ_BBOX.minLon},${RJ_BBOX.maxLat},${RJ_BBOX.maxLon},${RJ_BBOX.minLat}`,
    bounded: "1",
    limit: "10",
  });

  const resposta = await fetch(`${BASE}?${params}`, { headers: { "User-Agent": USER_AGENT } });
  if (!resposta.ok) {
    throw new Error(`Nominatim respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`);
  }
  return (await resposta.json()) as FeatureNominatim[];
}

/**
 * Nunca aceita "o primeiro resultado" cru: escolhe, entre os candidatos, o
 * que bate com a cidade E o bairro esperados (do ViaCEP). Se nenhum bater,
 * devolve `null` — melhor não ter resposta do que colocar a RT na rua certa
 * do bairro errado. Achado real (16/09/2026): "Rua Monte Pascoal" existe em
 * pelo menos 5 municípios da região metropolitana, e aceitar o primeiro
 * colocaria a RT de Cachambi na Pavuna.
 */
export async function geocodificarEndereco(endereco: ParametrosEndereco): Promise<ResultadoGeocodificacao | null> {
  const comNumero = [endereco.logradouro, endereco.numero].filter(Boolean).join(" ");

  let candidatos = await buscarCandidatos(comNumero, endereco.cidade, endereco.uf);
  // Sem candidato nenhum, tenta só o logradouro: um número que o OSM não
  // indexa pode zerar a busca inteira em vez de cair pro nível de rua.
  if (candidatos.length === 0 && endereco.numero) {
    candidatos = await buscarCandidatos(endereco.logradouro, endereco.cidade, endereco.uf);
  }

  const cidadeEsperada = normalizar(endereco.cidade);
  const bairroEsperado = normalizar(endereco.bairro);

  const naCidade = candidatos.filter((f) => normalizar(cidadeDe(f)) === cidadeEsperada);
  const resultado = bairroEsperado
    ? (naCidade.find((f) => normalizar(bairroDe(f)) === bairroEsperado) ?? null)
    : (naCidade[0] ?? null);
  if (!resultado) return null;

  const temNumero = Boolean(resultado.address?.house_number);
  const ehVia = resultado.category === "highway";

  return {
    lat: Number(resultado.lat),
    lng: Number(resultado.lon),
    label: resultado.display_name,
    confianca: temNumero ? 0.9 : ehVia ? 0.6 : 0.3,
    matchType: temNumero ? "exato" : ehVia ? "aproximado" : "fallback",
    cidadeGeocodificada: cidadeDe(resultado) || null,
    bairroGeocodificado: bairroDe(resultado) || null,
  };
}
