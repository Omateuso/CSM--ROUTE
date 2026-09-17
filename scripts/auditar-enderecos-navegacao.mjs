// Auditoria do endereço que o TÉCNICO recebe no link de navegação.
//
// Por que existe: mandar coordenada pro Google Maps fazia ele mostrar o
// endereço mais próximo do ponto, não o nosso — a SRT 3 (Rua Pernambuco
// 780) abria como "Rua Pernambuco 625". Desde 16/09/2026 o link vai com o
// endereço em TEXTO (ver lib/navegacao.ts), então o que importa auditar é
// a qualidade desse texto, RT por RT: tem número? o bairro cadastrado bate
// com o bairro do CEP? o CEP existe?
//
// Somente leitura — não escreve nada. Uso:
//   node scripts/auditar-enderecos-navegacao.mjs
import { readFileSync } from "node:fs";
import path from "node:path";

for (const linha of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normalizar = (t) =>
  (t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// Espelha textoEnderecoNavegacao() de lib/navegacao.ts — se aquele mudar,
// este precisa mudar junto (é auditoria, não pode divergir do que o técnico
// realmente recebe).
function textoNavegacao(rt) {
  const ruaNumero = rt.logradouro?.trim()
    ? [rt.logradouro.trim(), rt.numero?.trim()].filter(Boolean).join(", ")
    : rt.endereco?.trim() || null;
  if (!ruaNumero) return null;
  const partes = [ruaNumero];
  if (rt.bairro?.trim()) partes.push(rt.bairro.trim());
  const cidadeUf = [rt.cidade?.trim(), rt.uf?.trim()].filter(Boolean).join(" - ");
  if (cidadeUf) partes.push(cidadeUf);
  if (rt.cep?.trim()) partes.push(rt.cep.trim());
  return partes.join(", ");
}

const { data: rts, error } = await supabase
  .from("rts")
  .select("codigo, endereco, bairro, logradouro, numero, cidade, uf, cep, ativo")
  .order("codigo");
if (error) throw error;

const semNumero = [];
const semCep = [];
const bairroDivergente = [];
const semLogradouro = [];
const ok = [];

for (const rt of rts) {
  if (rt.codigo.includes("TESTE")) continue;

  const texto = textoNavegacao(rt);
  if (!rt.logradouro) semLogradouro.push({ rt, texto });
  if (!rt.numero) semNumero.push({ rt, texto });
  if (!rt.cep) {
    semCep.push({ rt, texto });
    continue;
  }

  const resp = await fetch(`https://viacep.com.br/ws/${rt.cep.replace("-", "")}/json/`);
  const via = resp.ok ? await resp.json() : null;
  await sleep(250);
  if (!via || via.erro) {
    semCep.push({ rt, texto, motivo: "CEP não encontrado no ViaCEP" });
    continue;
  }
  if (rt.bairro && via.bairro && normalizar(rt.bairro) !== normalizar(via.bairro)) {
    bairroDivergente.push({ rt, texto, bairroCep: via.bairro });
    continue;
  }
  if (rt.logradouro && via.logradouro && normalizar(rt.logradouro) !== normalizar(via.logradouro)) {
    bairroDivergente.push({ rt, texto, bairroCep: `logradouro do CEP: ${via.logradouro}` });
    continue;
  }
  if (rt.numero) ok.push({ rt, texto });
}

console.log(`=== SEM NÚMERO DA CASA (${semNumero.length}) — link cai no meio da rua ===`);
for (const x of semNumero) console.log(`  ${x.rt.codigo} — "${x.texto}"`);

console.log(`\n=== SEM LOGRADOURO ESTRUTURADO (${semLogradouro.length}) — usa o texto livre do cadastro ===`);
for (const x of semLogradouro) console.log(`  ${x.rt.codigo} — "${x.texto}"`);

console.log(`\n=== SEM CEP UTILIZÁVEL (${semCep.length}) ===`);
for (const x of semCep) console.log(`  ${x.rt.codigo}${x.motivo ? ` (${x.motivo})` : ""} — "${x.texto}"`);

console.log(`\n=== BAIRRO/LOGRADOURO DIVERGE DO CEP (${bairroDivergente.length}) — confira antes de confiar no link ===`);
for (const x of bairroDivergente) console.log(`  ${x.rt.codigo} — cadastro: "${x.texto}" | CEP diz: ${x.bairroCep}`);

console.log(`\n=== ENDEREÇO COMPLETO E CONSISTENTE COM O CEP (${ok.length}) ===`);
for (const x of ok.slice(0, 5)) console.log(`  ${x.rt.codigo} — "${x.texto}"`);
if (ok.length > 5) console.log(`  ... e mais ${ok.length - 5}`);

console.log(`\nTotal de RTs auditadas: ${rts.filter((r) => !r.codigo.includes("TESTE")).length}`);
