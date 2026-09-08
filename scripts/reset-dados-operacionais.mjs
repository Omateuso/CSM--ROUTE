// Zera os dados OPERACIONAIS pra testar o fluxo do começo.
//
//   node scripts/reset-dados-operacionais.mjs --confirmar
//
// Sem `--confirmar` ele só mostra o que APAGARIA, sem tocar em nada.
//
// APAGA: chamados, rotas, rota_rts, serviços (e o que cascateia deles —
// execuções, conclusões, evidências, validações), histórico, arquivos de
// evidência no Storage, e o relógio da sincronização.
//
// NÃO APAGA: RTs, CAPS, zonas, regiões, equipes, usuários/perfis, regras de
// SLA. Ou seja, o cadastro fica de pé — some só o que é execução do dia a dia.
//
// Depois de rodar, a próxima sincronização com o TomTicket repovoa os chamados
// (o relógio volta a zero, então ela pega a janela cheia de novo).

import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const linha of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const CONFIRMADO = process.argv.includes("--confirmar");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function contar(tabela) {
  const { count } = await supabase.from(tabela).select("*", { count: "exact", head: true });
  return count ?? 0;
}

const TABELAS = ["chamados", "rotas", "rota_rts", "servicos", "historico", "evidencias"];

console.log("Estado atual:");
for (const t of TABELAS) console.log(`  ${t.padEnd(12)} ${await contar(t)}`);

if (!CONFIRMADO) {
  console.log("\nNADA foi apagado. Rode de novo com --confirmar pra executar de verdade.");
  process.exit(0);
}

console.log("\nApagando...");

// Arquivos do Storage primeiro: depois de apagar `evidencias`, perdemos os
// caminhos e os arquivos ficariam órfãos no bucket pra sempre.
const { data: evidencias } = await supabase.from("evidencias").select("storage_path");
const caminhos = (evidencias ?? []).map((e) => e.storage_path).filter(Boolean);
if (caminhos.length > 0) {
  for (let i = 0; i < caminhos.length; i += 100) {
    const { error } = await supabase.storage.from("evidencias").remove(caminhos.slice(i, i + 100));
    if (error) console.error("  storage:", error.message);
  }
  console.log(`  storage: ${caminhos.length} arquivo(s) removido(s)`);
}

// Ordem ditada pelas FKs: `servicos.chamado_id` e `conclusoes.chamado_id` são
// `on delete restrict`, então serviço sai antes de chamado. `rota_rts` cascateia
// de `rotas`, e execuções/conclusões/evidências/validações cascateiam de
// `servicos` — mas apagamos explicitamente o que dá, pra contagem ficar honesta.
const ORDEM = ["historico", "servicos", "rotas", "chamados"];
for (const tabela of ORDEM) {
  const { error } = await supabase.from(tabela).delete().not("id", "is", null);
  console.log(`  ${tabela.padEnd(12)} ${error ? "ERRO: " + error.message : "ok"}`);
}

// Relógio da coleta volta a zero pra próxima sincronização trazer tudo de novo.
await supabase
  .from("sync_estado")
  .update({ ultima_leitura: null, ultima_execucao: null, ultimo_erro: null, novos: 0, atualizados: 0, ignorados: 0 })
  .eq("id", true);
await supabase.from("sync_nao_importados").delete().not("tomticket_id", "is", null);
console.log("  sync_estado  zerado");

console.log("\nEstado final:");
for (const t of TABELAS) console.log(`  ${t.padEnd(12)} ${await contar(t)}`);
console.log("\nAgora rode a sincronização (botão em /chamados) pra repovoar os chamados.");
