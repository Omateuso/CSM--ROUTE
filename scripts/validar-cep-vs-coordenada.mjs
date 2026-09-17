// Valida o CEP de cada RT contra a coordenada cadastrada.
//
// A pergunta que responde: "o CEP que está no cadastro aponta para perto de
// onde a RT realmente fica?". Se o CEP for de outra rua homônima em outro
// bairro (foi o caso das SRT 63-66, com o CEP da Rua Projetada do Jacaré em
// vez da Taquara, ~25km), a distância denuncia.
//
// Não valida NÚMERO da casa — o OpenStreetMap não indexa numeração na maior
// parte das ruas residenciais do Rio. Para esse nível seria preciso um
// geocodificador comercial (Google/HERE/Mapbox). Aqui o que se valida é:
// o logradouro+bairro que o CEP representa fica perto da coordenada da RT?
//
// Somente leitura. Uso: node scripts/validar-cep-vs-coordenada.mjs
import { readFileSync } from "node:fs";
import path from "node:path";

for (const l of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const USER_AGENT = "CSM-ROUTE-Sistema-Gestao-Operacional/1.0";
const RJ = { minLon: -44.9, minLat: -23.4, maxLon: -40.9, maxLat: -20.7 };
const SUSPEITO_KM = 3;

const norm = (t) =>
  (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const bairroDe = (f) => f.address?.suburb ?? f.address?.city_district ?? f.address?.neighbourhood ?? "";
const cidadeDe = (f) => f.address?.city ?? f.address?.town ?? f.address?.municipality ?? "";

async function geocodificarRua(logradouro, cidade, uf, bairroEsperado) {
  const params = new URLSearchParams({
    street: logradouro, city: cidade, state: uf, country: "Brasil",
    format: "jsonv2", addressdetails: "1", countrycodes: "br",
    viewbox: `${RJ.minLon},${RJ.maxLat},${RJ.maxLon},${RJ.minLat}`, bounded: "1", limit: "10",
  });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  await sleep(1100);
  if (!r.ok) return null;
  const lista = await r.json();
  const naCidade = lista.filter((f) => norm(cidadeDe(f)) === norm(cidade));
  return naCidade.find((f) => norm(bairroDe(f)) === norm(bairroEsperado)) ?? null;
}

const { data: rts } = await sb
  .from("rts")
  .select("codigo, endereco, bairro, logradouro, numero, cep, cidade, uf, latitude, longitude")
  .order("codigo");

const suspeitos = [], consistentes = [], inconclusivos = [];

for (const rt of rts) {
  if (rt.codigo.includes("TESTE") || !rt.cep) continue;

  const viaResp = await fetch(`https://viacep.com.br/ws/${rt.cep.replace("-", "")}/json/`);
  const via = viaResp.ok ? await viaResp.json() : null;
  await sleep(250);
  if (!via || via.erro) { inconclusivos.push({ rt, motivo: "CEP não existe no ViaCEP" }); continue; }

  const ponto = await geocodificarRua(via.logradouro, via.localidade, via.uf, via.bairro);
  if (!ponto) { inconclusivos.push({ rt, motivo: `OSM não tem "${via.logradouro}" em ${via.bairro}` }); continue; }

  const dist = haversineKm(
    { lat: Number(rt.latitude), lng: Number(rt.longitude) },
    { lat: Number(ponto.lat), lng: Number(ponto.lon) },
  );
  const item = { rt, via, dist };
  if (dist > SUSPEITO_KM) suspeitos.push(item); else consistentes.push(item);
  process.stderr.write(`\r${suspeitos.length + consistentes.length + inconclusivos.length}/${rts.length}...`);
}
process.stderr.write("\n\n");

console.log(`=== ⚠️ CEP SUSPEITO — aponta a mais de ${SUSPEITO_KM}km da coordenada da RT (${suspeitos.length}) ===`);
for (const s of suspeitos) {
  console.log(`  ${s.rt.codigo} — cadastro: "${s.rt.endereco}" (${s.rt.bairro})`);
  console.log(`      CEP ${s.rt.cep} = ${s.via.logradouro}, ${s.via.bairro} — a ${s.dist.toFixed(1)}km da coordenada da RT`);
}

console.log(`\n=== INCONCLUSIVO — sem como conferir pelo OpenStreetMap (${inconclusivos.length}) ===`);
for (const i of inconclusivos) console.log(`  ${i.rt.codigo} (CEP ${i.rt.cep}) — ${i.motivo}`);

console.log(`\n=== CEP CONSISTENTE com a coordenada (${consistentes.length}) ===`);
const piores = consistentes.sort((a, b) => b.dist - a.dist).slice(0, 8);
console.log("  (as 8 maiores distâncias, todas dentro do limite:)");
for (const c of piores) console.log(`  ${c.rt.codigo} — ${c.dist.toFixed(2)}km`);
