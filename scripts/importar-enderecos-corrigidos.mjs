// Substitui o endereço + coordenada de TODAS as RTs pela planilha revisada
// e verificada manualmente pelo usuário (17/09/2026):
// enderecos-coordenadas-ceps/RTs_enderecos_corrigidos.xlsx.
//
// Diferença crucial em relação ao backfill de 16/09 (scripts/importar-
// enderecos-rts.mjs): aquele geocodificava endereço→coordenada via
// Nominatim (aproximado, nível de rua). ESTE já vem com coordenada
// VERIFICADA — 84 RTs confirmadas pelo endereço impresso na conta de luz
// (Light), 14 confirmadas manualmente (visita/GPS de campo), fonte mais
// confiável que qualquer geocodificação. Por isso não há geocodificação
// nenhuma aqui — só validação de sanidade (distância vs. o que já estava
// salvo) antes de escrever.
//
// SRT 98 não é residência ("SRT SUPORTE TÉCNICO", sem endereço) — não
// existe como linha em `rts`, e a planilha confirma isso (status "Sem
// coordenada"). Fica de fora, sem erro.
//
// Uso:
//   node scripts/importar-enderecos-corrigidos.mjs              (dry-run)
//   node scripts/importar-enderecos-corrigidos.mjs --confirmar   (escreve)
import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

for (const l of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const { createClient } = await import("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CONFIRMAR = process.argv.includes("--confirmar");
const LIMIAR_KM = 0.8; // mesmo limiar da auditoria de 15-16/09

const TIPO_EXPANDIDO = { R: "Rua", AV: "Avenida", EST: "Estrada", TV: "Travessa", LD: "Ladeira", PC: "Praça" };

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function tituloBairro(texto) {
  const CONECTORES = new Set(["de", "da", "do", "das", "dos", "e"]);
  return texto
    .split(" ")
    .map((p, i) => (i > 0 && CONECTORES.has(p.toLowerCase()) ? p.toLowerCase() : p))
    .join(" ");
}

async function lerPlanilha() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(process.cwd(), "enderecos-coordenadas-ceps/RTs_enderecos_corrigidos.xlsx"));
  const sheet = wb.getWorksheet("ENDEREÇOS CORRIGIDOS");

  const registros = [];
  for (let r = 4; r <= 102; r++) {
    const row = sheet.getRow(r);
    const codigo = row.getCell(2).value;
    if (!codigo) continue;
    const tipo = row.getCell(3).value;
    const logradouro = row.getCell(4).value;
    const lat = row.getCell(10).value;
    const lng = row.getCell(11).value;
    if (!tipo || !logradouro || lat == null || lng == null) continue; // SRT 98

    const tipoExpandido = TIPO_EXPANDIDO[tipo] ?? tipo;
    const numero = row.getCell(5).value ? String(row.getCell(5).value) : null;
    const complemento = row.getCell(6).value ? String(row.getCell(6).value) : null;
    const bairro = tituloBairro(String(row.getCell(7).value ?? "").trim());
    const cep = row.getCell(8).value ? String(row.getCell(8).value).trim() : null;
    const status = row.getCell(12).value;

    const enderecoNovo =
      `${tipoExpandido} ${logradouro}, ${numero}` +
      (complemento ? `, ${complemento}` : "") +
      (bairro ? ` - ${bairro}` : "");

    registros.push({
      codigo: String(codigo).trim().replace(/^SRT\s*0*(\d+)$/i, "SRT $1"),
      logradouro: `${tipoExpandido} ${logradouro}`,
      numero,
      complemento,
      bairro,
      cep,
      cidade: "Rio de Janeiro",
      uf: "RJ",
      lat: Number(lat),
      lng: Number(lng),
      enderecoNovo,
      status,
    });
  }
  return registros;
}

async function main() {
  const planilha = await lerPlanilha();
  console.log(`Planilha lida: ${planilha.length} RTs com dado completo.\n`);

  const { data: rts, error } = await sb
    .from("rts")
    .select("id, codigo, endereco, bairro, latitude, longitude, regiao_id")
    .order("codigo");
  if (error) throw error;
  const porCodigo = new Map(rts.map((r) => [r.codigo, r]));

  const semRtNoBanco = planilha.filter((p) => !porCodigo.has(p.codigo));
  const rtsSemPlanilha = rts.filter((r) => !r.codigo.includes("TESTE") && !planilha.some((p) => p.codigo === r.codigo));

  const resultados = [];
  for (const p of planilha) {
    const rt = porCodigo.get(p.codigo);
    if (!rt) continue;
    const distanciaKm = haversineKm({ lat: Number(rt.latitude), lng: Number(rt.longitude) }, { lat: p.lat, lng: p.lng });
    resultados.push({ rt, p, distanciaKm });
  }

  const grandeDivergencia = resultados.filter((r) => r.distanciaKm > LIMIAR_KM).sort((a, b) => b.distanciaKm - a.distanciaKm);
  const pequenaDivergencia = resultados.filter((r) => r.distanciaKm <= LIMIAR_KM);

  console.log(`=== DIVERGÊNCIA >${LIMIAR_KM}km do que estava salvo (${grandeDivergencia.length}) — revisão normal, planilha é a fonte confiável agora ===`);
  for (const r of grandeDivergencia.slice(0, 20)) {
    console.log(
      `  ${r.rt.codigo} — salvo: ${r.rt.latitude},${r.rt.longitude} → novo: ${r.p.lat},${r.p.lng} (${r.distanciaKm.toFixed(2)}km, ${r.p.status})`,
    );
  }
  if (grandeDivergencia.length > 20) console.log(`  ... e mais ${grandeDivergencia.length - 20}`);

  console.log(`\n=== Coordenada já batia (≤${LIMIAR_KM}km) (${pequenaDivergencia.length}) ===`);

  if (semRtNoBanco.length > 0) {
    console.log(`\n=== NA PLANILHA MAS SEM RT NO BANCO (${semRtNoBanco.length}) ===`);
    for (const p of semRtNoBanco) console.log(`  ${p.codigo}`);
  }
  if (rtsSemPlanilha.length > 0) {
    console.log(`\n=== NO BANCO MAS SEM ENTRADA NA PLANILHA (${rtsSemPlanilha.length}) — fica como está ===`);
    for (const r of rtsSemPlanilha) console.log(`  ${r.codigo}`);
  }

  console.log(`\nTotal processado: ${resultados.length} RTs.`);

  if (!CONFIRMAR) {
    console.log("\n(dry-run — nada foi escrito. Rode com --confirmar depois de revisar.)");
    return;
  }

  console.log("\n--confirmar: gravando via fn_trocar_endereco_rt (endereço + coordenada + estruturado)...");
  let gravados = 0;
  let pulados = 0;
  for (const r of resultados) {
    const { error: rpcError } = await sb.rpc("fn_trocar_endereco_rt", {
      p_rt_id: r.rt.id,
      p_endereco: r.p.enderecoNovo,
      p_bairro: r.p.bairro,
      p_regiao_id: r.rt.regiao_id, // este import não muda região
      p_latitude: r.p.lat,
      p_longitude: r.p.lng,
      p_motivo: `Endereço/coordenada substituídos pela planilha revisada do usuário (17/09/2026) — ${r.p.status}`,
      p_cep: r.p.cep,
      p_logradouro: r.p.logradouro,
      p_numero: r.p.numero,
      p_complemento: r.p.complemento,
      p_cidade: r.p.cidade,
      p_uf: r.p.uf,
    });
    if (rpcError) {
      console.warn(`[erro] ${r.rt.codigo}: ${rpcError.message}`);
      pulados++;
    } else {
      gravados++;
    }
  }
  console.log(`\nGravados: ${gravados} | pulados: ${pulados}`);
}

main();
