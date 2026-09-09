// Mede o carregamento real de cada tela, com sessão autenticada.
//
//   node scripts/medir-desempenho.mjs
//   BASE_URL=http://localhost:3000 node scripts/medir-desempenho.mjs
//
// Usa a Navigation Timing API do próprio navegador (não cronômetro do script):
//   TTFB  — servidor pensando (consulta ao banco + render no servidor)
//   DCL   — HTML pronto e parseado
//   Load  — tudo baixado, inclusive JS
//
// Cada rota é visitada DUAS vezes. Em `next dev` a primeira inclui a compilação
// sob demanda, que não existe em produção — compare sempre a segunda.
//
// NÃO espera por um seletor específico: página de acesso negado não tem <h1>, e
// esperar por ele fazia a medição travar até o timeout (parecia lentidão da
// página, era erro do script).

import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SENHA = process.env.E2E_SENHA ?? "senha-teste-123";
const TIMEOUT = Number(process.env.E2E_TIMEOUT ?? 180000);

const PERFIS = [
  {
    email: process.env.E2E_EMAIL ?? "gerente.teste@csm.local",
    rotas: ["/dashboard", "/chamados", "/validacao", "/pendencias", "/rotas/montar", "/rotas/confirmadas", "/zonas", "/equipes"],
  },
  {
    email: "gestao.teste@csm.local",
    rotas: ["/painel", "/rts", "/relatorio"],
  },
];

const kb = (n) => `${Math.round(n / 1024)}kb`.padStart(8);
const ms = (n) => `${Math.round(n)}ms`.padStart(8);

const browser = await chromium.launch();

async function entrar(page, email) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  const pular = page.getByRole("button", { name: /Pular introdução/i });
  if (await pular.count()) await pular.click().catch(() => {});
  await page.waitForTimeout(2500);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', SENHA);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: TIMEOUT });
}

console.log(`Medindo ${BASE_URL}\n`);
console.log("rota                  1a(total)   TTFB      DCL      Load     HTML       JS");
console.log("-".repeat(78));

for (const perfil of PERFIS) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let bytesJs = 0;
  page.on("response", (r) => {
    if (r.request().resourceType() === "script") {
      bytesJs += Number(r.headers()["content-length"] ?? 0) || 0;
    }
  });

  await entrar(page, perfil.email);

  for (const rota of perfil.rotas) {
    const t0 = Date.now();
    await page.goto(BASE_URL + rota, { waitUntil: "load", timeout: TIMEOUT });
    const primeira = Date.now() - t0;

    bytesJs = 0;
    await page.goto(BASE_URL + rota, { waitUntil: "load", timeout: TIMEOUT });
    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      return { ttfb: n.responseStart - n.requestStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd };
    });
    const html = (await page.content()).length;

    console.log(
      rota.padEnd(20) +
        `${(primeira / 1000).toFixed(1)}s`.padStart(9) +
        ms(nav.ttfb) + ms(nav.dcl) + ms(nav.load) + kb(html) + kb(bytesJs),
    );
  }
  await page.close();
}

await browser.close();
