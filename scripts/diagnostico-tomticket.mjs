// Diagnóstico SOMENTE-LEITURA da integração com o TomTicket.
//
//   node scripts/diagnostico-tomticket.mjs [quantidade]
//
// Não escreve nada — nem no TomTicket, nem no nosso banco. Confere o token,
// acha o departamento, e valida o casamento chamado -> RT contra os chamados
// que JÁ estão no banco (importados da planilha), que são a verdade conhecida.

import { readFileSync } from "node:fs";
import path from "node:path";

for (const linha of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const TOKEN = process.env.TOMTICKET_TOKEN;
const BASE = "https://api.tomticket.com/v2.0";
const DEPARTAMENTO = process.env.TOMTICKET_DEPARTAMENTO ?? "MANUTENÇÃO - SRT";
const QUANTIDADE = Number(process.argv[2] ?? 100);

const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(caminho, params = {}) {
  const url = new URL(BASE + caminho);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  await sleep(340); // limite documentado: 3 req/s
  const r = await fetch(url, { headers: H });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok || corpo.error) throw new Error(`${caminho} -> HTTP ${r.status} ${corpo.message ?? ""}`);
  return corpo;
}

async function supa(caminho) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${caminho}`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  return r.json();
}

const numeroDaRt = (t) => {
  const m = String(t ?? "").match(/(\d+)/);
  return m ? String(Number(m[1])) : null;
};

const deps = await api("/department/list");
const dep = (deps.data ?? []).find((d) => (d.name ?? d.description) === DEPARTAMENTO);
if (!dep) {
  console.error(`Departamento "${DEPARTAMENTO}" não encontrado.`);
  process.exit(1);
}
console.log(`Departamento: ${DEPARTAMENTO} (${dep.id})`);

const lista = await api("/ticket/list", { page: "1", department_id: dep.id });
console.log(`Chamados no departamento: ${lista.size} em ${lista.pages} páginas\n`);

const rts = await supa("rts?select=id,codigo");
const porNumero = new Map();
for (const rt of rts) {
  const n = numeroDaRt(rt.codigo);
  if (n) porNumero.set(n, rt);
}

const ids = [];
for (let p = 1; ids.length < QUANTIDADE && p <= 20; p++) {
  const pg = await api("/ticket/list", { page: String(p), department_id: dep.id });
  for (const t of pg.data ?? []) ids.push({ id: t.id, protocol: String(t.protocol) });
  if (!pg.next_page || pg.next_page <= p) break;
}

console.log(`Conferindo ${Math.min(ids.length, QUANTIDADE)} chamados...\n`);

let semCampo = 0, casou = 0, naoCasou = [], conferidos = 0, divergentes = [];

for (const { id, protocol } of ids.slice(0, QUANTIDADE)) {
  const d = await api("/ticket/detail", { ticket_id: id });
  const t = Array.isArray(d.data) ? d.data[0] : d.data;
  const campo = (t?.custom_fields?.open ?? []).find((f) => String(f.label).trim().toUpperCase() === "RT");
  const valor = campo?.value ?? "";

  if (!valor) { semCampo++; continue; }
  const rt = porNumero.get(numeroDaRt(valor));
  if (!rt) { naoCasou.push(valor); continue; }
  casou++;

  // Verdade conhecida: o que a planilha já gravou pra esse protocolo.
  const [existente] = await supa(`chamados?select=rt_id&tomticket_id=eq.${protocol}`);
  if (existente) {
    conferidos++;
    if (existente.rt_id !== rt.id) divergentes.push(`${protocol}: campo="${valor}"`);
  }
}

console.log(`campo RT vazio ......... ${semCampo}`);
console.log(`casaram com uma RT ..... ${casou}`);
console.log(`NÃO casaram ............ ${naoCasou.length}${naoCasou.length ? " -> " + JSON.stringify([...new Set(naoCasou)]) : ""}`);
console.log(`\nconferidos contra o banco (import da planilha): ${conferidos}`);
console.log(`divergências ........... ${divergentes.length}${divergentes.length ? " -> " + JSON.stringify(divergentes.slice(0, 10)) : " (nenhuma)"}`);
