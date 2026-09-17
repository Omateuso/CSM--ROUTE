// Backup completo dos dados de localização das RTs — `rts` (campos de
// endereço/coordenada) + `rt_enderecos` inteiro (o histórico de endereços).
//
// Gera dois arquivos em scripts/backups/:
//   localizacao-rts-<timestamp>.json  — dado cru, pra reimportar por script
//   restaurar-localizacao-<timestamp>.sql — UPDATEs prontos, pra rodar no
//     SQL Editor do Supabase sem depender de nenhum script meu
//
// Somente leitura no banco. Uso: node scripts/backup-localizacao-rts.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

for (const l of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: rts, error: e1 } = await sb
  .from("rts")
  .select("id, codigo, nome, endereco, bairro, regiao_id, latitude, longitude, cep, logradouro, numero, complemento, cidade, uf")
  .order("codigo");
if (e1) throw e1;

const { data: enderecos, error: e2 } = await sb
  .from("rt_enderecos")
  .select("*")
  .order("rt_id")
  .order("vigente_desde");
if (e2) throw e2;

const carimbo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = path.join(process.cwd(), "scripts", "backups");
mkdirSync(dir, { recursive: true });

const jsonPath = path.join(dir, `localizacao-rts-${carimbo}.json`);
writeFileSync(
  jsonPath,
  JSON.stringify({ geradoEm: new Date().toISOString(), totalRts: rts.length, totalEnderecos: enderecos.length, rts, rt_enderecos: enderecos }, null, 2),
  "utf8",
);

// SQL de restauração — não depende de nenhum script, é só colar no SQL Editor.
const esc = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const linhas = [
  "-- Restauração dos dados de localização das RTs",
  `-- Gerado em ${new Date().toISOString()} a partir de ${rts.length} RTs.`,
  "-- Repõe exatamente o estado que estava no banco no momento do backup.",
  "begin;",
  "",
];
for (const r of rts) {
  linhas.push(
    `update rts set endereco = ${esc(r.endereco)}, bairro = ${esc(r.bairro)}, latitude = ${r.latitude}, longitude = ${r.longitude}, ` +
      `cep = ${esc(r.cep)}, logradouro = ${esc(r.logradouro)}, numero = ${esc(r.numero)}, complemento = ${esc(r.complemento)}, ` +
      `cidade = ${esc(r.cidade)}, uf = ${esc(r.uf)} where id = '${r.id}'; -- ${r.codigo}`,
  );
}
linhas.push("", "-- Histórico (rt_enderecos) — só as linhas vigentes:", "");
for (const e of enderecos.filter((x) => x.vigente_ate == null)) {
  linhas.push(
    `update rt_enderecos set endereco = ${esc(e.endereco)}, bairro = ${esc(e.bairro)}, latitude = ${e.latitude}, longitude = ${e.longitude}, ` +
      `cep = ${esc(e.cep)}, logradouro = ${esc(e.logradouro)}, numero = ${esc(e.numero)}, complemento = ${esc(e.complemento)}, ` +
      `cidade = ${esc(e.cidade)}, uf = ${esc(e.uf)} where id = '${e.id}';`,
  );
}
linhas.push("", "commit;", "");

const sqlPath = path.join(dir, `restaurar-localizacao-${carimbo}.sql`);
writeFileSync(sqlPath, linhas.join("\n"), "utf8");

console.log(`Backup gerado:`);
console.log(`  ${path.relative(process.cwd(), jsonPath)}  (${rts.length} RTs, ${enderecos.length} linhas de histórico)`);
console.log(`  ${path.relative(process.cwd(), sqlPath)}  (SQL de restauração, roda no SQL Editor)`);
const comCoord = rts.filter((r) => r.latitude != null && r.longitude != null).length;
const comCep = rts.filter((r) => r.cep).length;
console.log(`\nConteúdo: ${comCoord} com coordenada, ${comCep} com CEP, ${rts.length - comCep} sem CEP.`);
