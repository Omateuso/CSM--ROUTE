// Diagnóstico SOMENTE-LEITURA das coordenadas cadastradas das RTs.
//
//   node scripts/diagnostico-coordenadas-rts.mjs
//
// Não escreve nada. Geocodifica o endereço de cada RT via Nominatim
// (OpenStreetMap, gratuito) e compara com a lat/long salva no banco —
// achado real (usuário, 15/09/2026): "Rua Pernambuco 780" aparecendo no
// mapa como se fosse outro número. O sistema NUNCA teve geocodificação
// automática (lat/long é digitada à mão na tela de cadastro de RT,
// app/(gestao)/rts/rt-create-dialog.tsx) — isso é uma auditoria de
// qualidade de dado, não uma correção de bug de código.
//
// Respeita o limite de uso do Nominatim público (1 req/s, User-Agent
// identificando o uso) — não é scraping em massa, é uma auditoria pontual
// das ~99 RTs cadastradas, cada uma consultada 1x.
import { readFileSync } from "node:fs";
import path from "node:path";

for (const linha of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "CSM-ROUTE-auditoria-coordenadas/1.0 (uso pontual, nao automatizado em producao)";
// Acima disso, a coordenada salva não bate nem com a margem de imprecisão
// já observada em ruas sem numeração mapeada no OSM (~500m entre trechos
// desconexos da mesma rua) — vira candidata forte a revisão manual.
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

async function geocodificar(query) {
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  const resposta = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" } });
  if (!resposta.ok) return null;
  const json = await resposta.json();
  const primeiro = json[0];
  if (!primeiro) return null;
  return { lat: Number(primeiro.lat), lng: Number(primeiro.lon), tipo: primeiro.addresstype ?? primeiro.type };
}

async function main() {
  const { data: rts, error } = await supabase
    .from("rts")
    .select("codigo, nome, endereco, bairro, latitude, longitude")
    .order("codigo");
  if (error) throw error;

  const alvos = rts.filter((r) => !r.codigo.includes("TESTE")); // exclui a RT fictícia de teste

  const semResultado = [];
  const suspeitas = [];
  const ok = [];

  for (const [i, rt] of alvos.entries()) {
    const enderecoPrincipal = rt.endereco.split(" - ")[0];
    const query = `${enderecoPrincipal}, ${rt.bairro}, Rio de Janeiro, Brasil`;

    let geo;
    try {
      geo = await geocodificar(query);
    } catch (err) {
      geo = null;
      console.warn(`[erro] ${rt.codigo}: ${err.message}`);
    }

    if (!geo) {
      semResultado.push(rt);
    } else {
      const distanciaKm = haversineKm({ lat: rt.latitude, lng: rt.longitude }, geo);
      const linha = { ...rt, geo, distanciaKm };
      if (distanciaKm > LIMIAR_KM) suspeitas.push(linha);
      else ok.push(linha);
    }

    process.stderr.write(`\r${i + 1}/${alvos.length} conferidas...`);
    await sleep(1100); // 1 req/s do Nominatim público, com folga
  }
  process.stderr.write("\n");

  suspeitas.sort((a, b) => b.distanciaKm - a.distanciaKm);

  console.log(`\n=== SUSPEITAS (distância > ${LIMIAR_KM}km entre o salvo e o geocodificado): ${suspeitas.length} ===`);
  for (const s of suspeitas) {
    console.log(
      `${s.codigo} — ${s.endereco} (${s.bairro})\n  salvo:  ${s.latitude}, ${s.longitude}\n  geocod: ${s.geo.lat}, ${s.geo.lng} (${s.geo.tipo})\n  distância: ${s.distanciaKm.toFixed(2)}km\n`,
    );
  }

  console.log(`\n=== SEM RESULTADO NO NOMINATIM (não dá pra conferir por esse meio): ${semResultado.length} ===`);
  for (const s of semResultado) console.log(`${s.codigo} — ${s.endereco} (${s.bairro})`);

  console.log(`\n=== OK (dentro de ${LIMIAR_KM}km do geocodificado): ${ok.length} ===`);

  console.log(`\nTotal conferido: ${alvos.length}`);
}

main();
