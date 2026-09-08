// Abre as telas principais num navegador de verdade, confere que renderizam e
// reporta erros de console. Não substitui olhar a tela — serve pra pegar
// regressão silenciosa (tela que virou erro 500, texto que sumiu).
//
//   node scripts/verificar-telas.mjs
//   BASE_URL=https://... node scripts/verificar-telas.mjs
//
// Nada aqui é específico desta máquina: a URL vem do ambiente (default
// localhost:3000), as credenciais também, e os screenshots caem numa pasta
// relativa à raiz do projeto (ignorada pelo git).

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "gerente.teste@csm.local";
const SENHA = process.env.E2E_SENHA ?? "senha-teste-123";
const SAIDA = path.join(process.cwd(), ".screenshots");

// Em dev o Next compila a rota na PRIMEIRA visita, e isso passa fácil dos
// timeouts padrão do Playwright. Em produção some.
const TIMEOUT = Number(process.env.E2E_TIMEOUT ?? 180000);

const TELAS = [
  ["chamados", "/chamados"],
  ["validacao", "/validacao"],
  ["pendencias", "/pendencias"],
  ["dashboard", "/dashboard"],
  ["rotas-confirmadas", "/rotas/confirmadas"],
];

const erros = [];

async function main() {
  await mkdir(SAIDA, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on("console", (m) => {
    if (m.type() === "error") erros.push(`[console] ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => erros.push(`[pageerror] ${e.message.slice(0, 200)}`));

  console.log(`Entrando em ${BASE_URL} como ${EMAIL}...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  // A tela de login abre com uma introdução animada que remonta o formulário.
  // Preencher antes dela terminar faz o React limpar os campos, e o submit sai
  // com e-mail/senha vazios ("missing email or phone"). Pula a introdução.
  const pular = page.getByRole("button", { name: /Pular introdução/i });
  if (await pular.count()) await pular.click().catch(() => {});
  await page.waitForTimeout(2500);

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', SENHA);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: TIMEOUT });
  console.log("ok\n");

  for (const [nome, rota] of TELAS) {
    process.stdout.write(`${rota} ... `);
    const resposta = await page.goto(`${BASE_URL}${rota}`, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT,
    });
    // Espera o conteúdo pintar (server component + hidratação).
    await page.locator("h1").first().waitFor({ timeout: TIMEOUT });

    const titulo = (await page.locator("h1").first().innerText()).trim();
    const arquivo = path.join(SAIDA, `${nome}.png`);
    await page.screenshot({ path: arquivo });
    console.log(`${resposta?.status() ?? "?"} — "${titulo}"`);
  }

  await browser.close();

  console.log(`\nScreenshots em ${SAIDA}`);
  if (erros.length > 0) {
    console.error(`\n${erros.length} erro(s) de console:`);
    for (const e of erros) console.error("  " + e);
    process.exitCode = 1;
  } else {
    console.log("Nenhum erro de console.");
  }
}

main().catch((erro) => {
  console.error("\nFalhou:", erro.message);
  process.exitCode = 1;
});
