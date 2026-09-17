// Backfill de endereço estruturado + CEP + coordenada geocodificada pra
// TODAS as RTs, a partir da lista oficial que o usuário forneceu em
// 16/09/2026 (docs/referencias/ — PDF "enderecos_atualizados_padronizado",
// extraído pra scripts/data-rts-enderecos-oficiais.json: código, endereço
// completo e CEP por RT, 98 registros, SRT 98 não consta no documento).
//
// Uso:
//   node scripts/importar-enderecos-rts.mjs              (dry-run, só relatório — padrão)
//   node scripts/importar-enderecos-rts.mjs --confirmar   (escreve de verdade via fn_trocar_endereco_rt)
//
// Requer a migration 0060_endereco_estruturado_cep.sql já aplicada — sem
// ela, a função no banco ainda tem a assinatura antiga (sem os parâmetros
// de CEP/logradouro/etc.) e a escrita falha explicitamente (não em
// silêncio) com uma mensagem apontando isso.
//
// Fluxo por RT: CEP → ViaCEP (logradouro/bairro/cidade/UF estruturados,
// gratuito, sem chave) → texto completo → Nominatim (OpenStreetMap,
// gratuito, sem chave, SEM cota diária — trocado do ORS em 16/09/2026
// depois de esgotar a cota de 2.500/dia num teste real e descobrir, ao
// vivo, que o ORS/Pelias sem restrição geográfica forte casou o nome de
// rua com uma via homônima em OUTRO ESTADO pra 7 RTs, com "confiança
// 1.00" — teria corrompido essas RTs se rodasse direto em --confirmar.
// Nominatim com busca ESTRUTURADA (campos separados: street/city/state) +
// viewbox travando no RJ (`bounded=1`, hard filter) resolveu isso nos
// testes ao vivo. `numero` É extraído e gravado (é o que faz o link de
// navegação do técnico cair na porta certa, ver lib/navegacao.ts);
// `complemento` fica NULL de propósito — "CASA 08", "AP. 602", "LOTE 01 -
// QUADRA 17 - BLOCO 01", "COND. STELA DO PATROCÍNIO" são variados demais
// pra separar por regex sem errar, e não ajudam a geolocalizar; ficam pro
// gerente completar depois, pela tela de troca de endereço, se quiser.
// Compara com a coordenada atual salva no banco (mesmo limiar de 0,8km da
// auditoria de 15/09) → relatório, sempre em dry-run primeiro.
import { readFileSync } from "node:fs";
import path from "node:path";

for (const linha of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CONFIRMAR = process.argv.includes("--confirmar");
const LIMIAR_KM = 0.8;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// "RUA CLAUDIO DA COSTA, 24 - IRAJÁ" -> "Rua Claudio da Costa, 24 - Irajá"
// (mesmo estilo já usado nos endereços existentes do banco).
const CONECTORES_MINUSCULOS = new Set(["de", "da", "do", "das", "dos", "e", "n"]);
function titleCase(texto) {
  return texto
    .toLowerCase()
    .split(" ")
    .map((palavra, i) => {
      if (i > 0 && CONECTORES_MINUSCULOS.has(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(" ");
}

async function buscarCep(cep) {
  const resposta = await fetch(`https://viacep.com.br/ws/${cep.replace("-", "")}/json/`);
  if (!resposta.ok) return null;
  const json = await resposta.json();
  if (json.erro) return null;
  return { logradouro: json.logradouro ?? "", bairro: json.bairro ?? "", cidade: json.localidade ?? "", uf: json.uf ?? "" };
}

// Bounding box do estado do Rio de Janeiro (com folga) — hard filter via
// `bounded=1`, não só dica de proximidade. Sem isso, o geocodificador pode
// casar o nome da rua com uma via homônima em outro estado (achado real
// do dry-run de 16/09 com o ORS: SRT 10/14/49/63/64/65/66 vieram com
// "confiança 1.00" apontando pra Porto Alegre, interior do Amazonas,
// Curitiba e interior do Piauí — centenas a milhares de km de distância).
const RJ_BBOX = { minLon: -44.9, minLat: -23.4, maxLon: -40.9, maxLat: -20.7 };
const USER_AGENT = "CSM-ROUTE-Sistema-Gestao-Operacional/1.0";

const normalizar = (t) =>
  (t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// "RUA PERNAMBUCO, 780 AP. 602 - ENGENHO DE DENTRO" -> "780"
// "RUA PERNAMBUCO Nº 635- CASA 08 - ..."            -> "635"
function extrairNumero(enderecoCompleto) {
  const semBairro = enderecoCompleto.replace(/\s*-\s*[^-]+$/, "");
  const m = semBairro.match(/(?:,|nº|n°|n\.?º?|\s)\s*(\d{1,6})\b/i);
  return m ? m[1] : null;
}

const bairroDe = (f) => f.address?.suburb ?? f.address?.city_district ?? f.address?.neighbourhood ?? "";
const cidadeDe = (f) => f.address?.city ?? f.address?.town ?? f.address?.municipality ?? "";

async function buscarCandidatos(street, cidade, uf) {
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

  // ⚠️ NÃO mandar Accept-Language: testado ao vivo em 16/09/2026, o MESMO
  // request com `Accept-Language: pt-BR` devolve resultado DIFERENTE e
  // errado ("Rua Joaquim Soares" ia parar em Niterói; sem o header vem em
  // Piedade/Rio, a correta). O header mexe no ranking, não só no idioma.
  const resposta = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!resposta.ok) throw new Error(`Nominatim ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`);
  return resposta.json();
}

// Nunca aceita "o primeiro resultado" cru: escolhe o candidato que bate com
// a cidade E o bairro do ViaCEP. Nenhum bateu -> null (melhor sem resposta
// do que a rua certa no bairro errado: "Rua Monte Pascoal" existe em 5
// municípios da região metropolitana).
async function geocodificar({ enderecoCompleto, cidade, uf, bairro, logradouroViacep }) {
  const numero = extrairNumero(enderecoCompleto);
  // Logradouro canônico do ViaCEP é bem mais limpo que o texto livre do
  // PDF ("AP. 602", "CASA 08", "COND. GRAMADO" zeram a busca) — mas a
  // grafia às vezes diverge do OSM ("Luís" x "Luiz"), então o texto do PDF
  // continua valendo como segunda tentativa.
  const doPdf = enderecoCompleto.replace(/\s*-\s*[^-]+$/, "").trim();
  const tentativas = [];
  if (logradouroViacep) tentativas.push(numero ? `${logradouroViacep} ${numero}` : logradouroViacep);
  if (logradouroViacep && numero) tentativas.push(logradouroViacep);
  tentativas.push(doPdf);

  for (const street of tentativas) {
    const candidatos = await buscarCandidatos(street, cidade, uf);
    await sleep(1100); // 1 req/s, política de uso do Nominatim

    const naCidade = candidatos.filter((f) => normalizar(cidadeDe(f)) === normalizar(cidade));
    const escolhido = bairro
      ? (naCidade.find((f) => normalizar(bairroDe(f)) === normalizar(bairro)) ?? null)
      : (naCidade[0] ?? null);
    if (!escolhido) continue;

    const temNumero = Boolean(escolhido.address?.house_number);
    const ehVia = escolhido.category === "highway";
    return {
      lat: Number(escolhido.lat),
      lng: Number(escolhido.lon),
      label: escolhido.display_name,
      confianca: temNumero ? 0.9 : ehVia ? 0.6 : 0.3,
      matchType: temNumero ? "exato" : ehVia ? "aproximado" : "fallback",
      cidadeGeocodificada: cidadeDe(escolhido) || null,
      bairroGeocodificado: bairroDe(escolhido) || null,
      queryUsada: street,
    };
  }
  return null;
}

async function main() {
  const oficiais = JSON.parse(readFileSync(path.join(process.cwd(), "scripts/data-rts-enderecos-oficiais.json"), "utf8"));

  const { data: rts, error } = await supabase
    .from("rts")
    .select("id, codigo, endereco, bairro, latitude, longitude, regiao_id");
  if (error) throw error;
  const porCodigo = new Map(rts.map((r) => [r.codigo, r]));

  const semRtCorrespondente = oficiais.filter((o) => !porCodigo.has(o.codigo));
  const rtsSemDadoOficial = rts.filter((r) => !r.codigo.includes("TESTE") && !oficiais.some((o) => o.codigo === r.codigo));

  const resultados = [];
  for (const [i, oficial] of oficiais.entries()) {
    const rt = porCodigo.get(oficial.codigo);
    if (!rt) continue;

    const cepFormatado = oficial.cep;
    let viacep = null;
    try {
      viacep = await buscarCep(cepFormatado);
    } catch (err) {
      console.warn(`[viacep erro] ${oficial.codigo}: ${err.message}`);
    }
    await sleep(300);

    const cidade = viacep?.cidade || "Rio de Janeiro";
    const uf = viacep?.uf || "RJ";

    let geo = null;
    try {
      geo = await geocodificar({
        enderecoCompleto: oficial.enderecoCompleto,
        cidade,
        uf,
        bairro: viacep?.bairro ?? null,
        logradouroViacep: viacep?.logradouro ?? null,
      });
    } catch (err) {
      console.warn(`[geocode erro] ${oficial.codigo}: ${err.message}`);
    }

    const distanciaKm = geo ? haversineKm({ lat: rt.latitude, lng: rt.longitude }, geo) : null;
    // A própria geocodificar() já só devolve resultado que bate cidade E
    // bairro do ViaCEP — então qualquer `geo` não-nulo já é confiável.
    const coordenadaConfiavel = Boolean(geo);
    resultados.push({
      rt,
      oficial,
      viacep,
      cidade,
      uf,
      geo,
      distanciaKm,
      coordenadaConfiavel,
      corrigirCoordenada: Boolean(coordenadaConfiavel && distanciaKm > LIMIAR_KM),
      enderecoNovo: titleCase(oficial.enderecoCompleto),
      bairroNovo: viacep?.bairro ? titleCase(viacep.bairro) : rt.bairro,
      // O número é o que faz o link de navegação do técnico cair na PORTA
      // certa (o Google resolve o texto "logradouro, número, bairro,
      // cidade, CEP") — sem ele, cai no meio da rua. Ver lib/navegacao.ts.
      numero: extrairNumero(oficial.enderecoCompleto),
    });

    process.stderr.write(`\r${i + 1}/${oficiais.length} processadas...`);
  }
  process.stderr.write("\n\n");

  const semResultado = resultados.filter((r) => !r.geo);
  const corrigir = resultados.filter((r) => r.corrigirCoordenada);
  const mantemCoordenada = resultados.filter((r) => r.geo && !r.corrigirCoordenada);

  console.log(
    `=== SEM RESULTADO CONFIÁVEL (${semResultado.length}) — nenhum candidato no bairro certo, precisam de coordenada manual ===`,
  );
  for (const r of semResultado) console.log(`  ${r.oficial.codigo} — ${r.oficial.enderecoCompleto} (CEP ${r.oficial.cep})`);

  console.log(`\n=== VAI CORRIGIR COORDENADA — diverge >${LIMIAR_KM}km do salvo (${corrigir.length}) ===`);
  for (const r of corrigir) {
    console.log(
      `  ${r.oficial.codigo} — salvo: ${r.rt.latitude},${r.rt.longitude} → novo: ${r.geo.lat.toFixed(6)},${r.geo.lng.toFixed(6)} (${r.distanciaKm.toFixed(2)}km, ${r.geo.matchType}, bairro ${r.geo.bairroGeocodificado})`,
    );
  }

  console.log(`\n=== COORDENADA MANTIDA — já bate com o endereço/CEP oficial (${mantemCoordenada.length}) ===`);

  if (semRtCorrespondente.length > 0) {
    console.log(`\n=== NA LISTA OFICIAL MAS SEM RT CORRESPONDENTE NO BANCO (${semRtCorrespondente.length}) ===`);
    for (const o of semRtCorrespondente) console.log(`  ${o.codigo}`);
  }
  if (rtsSemDadoOficial.length > 0) {
    console.log(`\n=== NO BANCO MAS SEM ENTRADA NA LISTA OFICIAL (${rtsSemDadoOficial.length}) — fica como está ===`);
    for (const r of rtsSemDadoOficial) console.log(`  ${r.codigo}`);
  }

  console.log(`\nTotal na lista oficial: ${oficiais.length} | processadas: ${resultados.length}`);

  if (!CONFIRMAR) {
    console.log("\n(dry-run — nada foi escrito. Rode com --confirmar depois de revisar o relatório acima.)");
    return;
  }

  // Decisão do usuário (16/09/2026, depois de ver a SRT 3 com coordenada
  // errada num caso real): usar a tabela oficial pra corrigir também a
  // coordenada, não só CEP/logradouro/cidade/UF — mas só quando o
  // geocodificador achar a rua na cidade certa E o ponto novo divergir de
  // verdade (>0,8km) do que já está salvo. Coordenada que já bate fica
  // intocada (nada a ganhar reescrevendo pra uma aproximação de mesma
  // precisão); "sem resultado" (rua sem numeração indexada no OSM, ex.:
  // SRT 3 — Rua Pernambuco não tem número indexado) não tem como ser
  // corrigido por essa via, fica registrado no relatório acima pra
  // correção manual.
  //
  // Quando a coordenada MUDA: fn_trocar_endereco_rt (fecha o período
  // vigente, abre um novo com motivo — é o único jeito correto de mudar
  // coordenada/endereço, preserva histórico). Quando NÃO muda: update
  // direto em rts + na linha vigente de rt_enderecos, só cep/logradouro/
  // cidade/uf — não faz sentido abrir um novo período de "endereço" só
  // por causa de metadado que não estava lá antes.
  console.log("\n--confirmar: gravando cep/logradouro/cidade/uf pra todos + coordenada onde diverge >0,8km...");
  let corrigidos = 0;
  let metadadoGravado = 0;
  let pulados = 0;
  for (const r of resultados) {
    const cidadeResolvida = (r.viacep?.cidade ?? "Rio de Janeiro").trim().toLowerCase();
    if (cidadeResolvida !== "rio de janeiro") {
      console.warn(
        `[pulado] ${r.oficial.codigo}: CEP ${r.oficial.cep} resolve pra "${r.viacep?.cidade}" (não Rio de Janeiro) — confirme com o usuário antes de gravar.`,
      );
      pulados++;
      continue;
    }

    const logradouro = r.viacep?.logradouro ? titleCase(r.viacep.logradouro) : null;

    if (r.corrigirCoordenada) {
      const { error: rpcError } = await supabase.rpc("fn_trocar_endereco_rt", {
        p_rt_id: r.rt.id,
        p_endereco: r.enderecoNovo,
        p_bairro: r.bairroNovo,
        p_regiao_id: r.rt.regiao_id, // região não muda por essa correção
        p_latitude: r.geo.lat,
        p_longitude: r.geo.lng,
        p_motivo: "Correção de coordenada via geocodificação — endereço oficial fornecido pelo usuário (16/09/2026)",
        p_cep: r.oficial.cep,
        p_logradouro: logradouro,
        p_numero: r.numero,
        p_complemento: null,
        p_cidade: r.cidade,
        p_uf: r.uf,
      });
      if (rpcError) {
        console.warn(`[corrige erro] ${r.oficial.codigo}: ${rpcError.message}`);
        pulados++;
        continue;
      }
      corrigidos++;
      continue;
    }

    const campos = { cep: r.oficial.cep, logradouro, numero: r.numero, cidade: r.cidade, uf: r.uf };

    const { error: rtsError } = await supabase.from("rts").update(campos).eq("id", r.rt.id);
    if (rtsError) {
      console.warn(`[grava erro - rts] ${r.oficial.codigo}: ${rtsError.message}`);
      pulados++;
      continue;
    }

    const { error: histError } = await supabase
      .from("rt_enderecos")
      .update(campos)
      .eq("rt_id", r.rt.id)
      .is("vigente_ate", null);
    if (histError) {
      console.warn(`[grava erro - rt_enderecos] ${r.oficial.codigo}: ${histError.message}`);
      pulados++;
      continue;
    }

    metadadoGravado++;
  }
  console.log(`\nCoordenada corrigida: ${corrigidos} | só metadado: ${metadadoGravado} | pulados: ${pulados}`);
}

main();
