#!/usr/bin/env node
// Gera o conjunto de ícones do app (PWA "instalar"/"adicionar à tela de
// início" no Android/iOS + favicon da aba do navegador), pedido do usuário
// em 15/09/2026 — os ícones que existiam até aqui (public/icon-192.png,
// icon-512.png, apple-touch-icon.png, app/favicon.ico) eram todos
// placeholder: um quadrado azul-marinho liso e o triângulo padrão do
// create-next-app, nunca substituídos.
//
// Glifo: a mesma "rota" (dois pontos + curva em S) já usada no ícone
// `route` do menu lateral (app/nav-icons.tsx) — reaproveita a identidade
// visual que já existe no produto em vez de inventar uma nova. Cor de
// fundo: teal `#008a83`, a cor "unificada" do sistema (botão Entrar do
// login, badge do menu, OperacaoHojeCard — decisão de 27/08/2026).
//
// Roda sob demanda (não faz parte do build) — reexecute se a cor/glifo
// mudar: `node scripts/gerar-icones-pwa.mjs`.
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(__dirname, "..");
const publicDir = path.join(raiz, "public");
const appDir = path.join(raiz, "app");

const TEAL = "#008a83";

// Glifo em viewBox 24x24 (path data idêntico ao ícone `route` do menu) —
// bounding box aproximado: x 3.6–20.4, y 2.6–21.4 (~15px de padding natural
// num canvas de 24). `escala`/`deslocamento` recentralizam e redimensionam
// esse mesmo desenho para cada variante sem redesenhar path nenhum.
function glifoRota({ escala = 1, corTraco = "#ffffff", larguraTraco = 2.1 }) {
  const cx = 12;
  const cy = 12;
  return `
    <g transform="translate(${cx} ${cy}) scale(${escala}) translate(${-cx} ${-cy})"
       fill="none" stroke="${corTraco}" stroke-width="${larguraTraco}"
       stroke-linecap="round" stroke-linejoin="round">
      <circle cx="6" cy="19" r="2.4" />
      <circle cx="18" cy="5" r="2.4" />
      <path d="M15.6 5H9a3.5 3.5 0 0 0 0 7h6a3.5 3.5 0 0 1 0 7H8.4" />
    </g>
  `;
}

// `any`: baked-in rounded corners (squircle simples) — usado em contextos
// que não aplicam máscara própria (atalho de navegador, alguns launchers).
function svgAny({ tamanho, raioCanto }) {
  return `
    <svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="24" height="24" rx="${raioCanto}" fill="${TEAL}" />
      ${glifoRota({ escala: 1 })}
    </svg>
  `;
}

// `maskable`: fundo edge-to-edge (o SO aplica a própria máscara — círculo,
// squircle, etc.) — o glifo precisa caber inteiro dentro da "zona segura"
// central (~80% do diâmetro, raio 9.6 num canvas de 24 centrado em 12,12).
// O bounding radius natural do glifo (~11.6) estoura essa zona; escala 0.72
// traz o ponto mais distante para ~8.35, com folga.
function svgMaskable({ tamanho }) {
  return `
    <svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="24" height="24" fill="${TEAL}" />
      ${glifoRota({ escala: 0.72 })}
    </svg>
  `;
}

// Apple Touch Icon: iOS arredonda os cantos sozinho e não aceita
// transparência (pinta de preto por baixo) — fundo opaco, sem raio.
function svgApple({ tamanho }) {
  return `
    <svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="24" height="24" fill="${TEAL}" />
      ${glifoRota({ escala: 0.92 })}
    </svg>
  `;
}

async function png(svg, tamanho) {
  return sharp(Buffer.from(svg)).resize(tamanho, tamanho).png().toBuffer();
}

// Monta um .ico válido (formato ICONDIR) embutindo PNGs — suportado desde o
// Windows Vista e por todos os navegadores atuais; evita depender de uma
// lib externa só para isso.
function montarIco(pngsPorTamanho) {
  const n = pngsPorTamanho.length;
  const headerSize = 6 + n * 16;
  let offset = headerSize;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo: ícone
  header.writeUInt16LE(n, 4); // nº de imagens

  const entries = [];
  const datas = [];
  for (const { tamanho, buffer } of pngsPorTamanho) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(tamanho >= 256 ? 0 : tamanho, 0); // 0 = 256px
    entry.writeUInt8(tamanho >= 256 ? 0 : tamanho, 1);
    entry.writeUInt8(0, 2); // paleta
    entry.writeUInt8(0, 3); // reservado
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits por pixel
    entry.writeUInt32LE(buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buffer.length;
    entries.push(entry);
    datas.push(buffer);
  }
  return Buffer.concat([header, ...entries, ...datas]);
}

async function main() {
  mkdirSync(publicDir, { recursive: true });

  // Ícones "any" (manifest + <link rel="icon">) — cantos levemente
  // arredondados (rx=5 num canvas de 24, ~21%), mesmo raio visual usado nos
  // cards do produto.
  const icon192 = await png(svgAny({ tamanho: 192, raioCanto: 5 }), 192);
  const icon512 = await png(svgAny({ tamanho: 512, raioCanto: 5 }), 512);
  writeFileSync(path.join(publicDir, "icon-192.png"), icon192);
  writeFileSync(path.join(publicDir, "icon-512.png"), icon512);

  // Maskable (Android "adicionar à tela inicial" com máscara adaptativa).
  const iconMaskable = await png(svgMaskable({ tamanho: 512 }), 512);
  writeFileSync(path.join(publicDir, "icon-maskable-512.png"), iconMaskable);

  // Apple touch icon (iOS "Adicionar à Tela de Início").
  const iconApple = await png(svgApple({ tamanho: 180 }), 180);
  writeFileSync(path.join(publicDir, "apple-touch-icon.png"), iconApple);

  // Favicon da aba — 16/32/48px num .ico só (mesmo raio da versão "any").
  const fav16 = await png(svgAny({ tamanho: 16, raioCanto: 5 }), 16);
  const fav32 = await png(svgAny({ tamanho: 32, raioCanto: 5 }), 32);
  const fav48 = await png(svgAny({ tamanho: 48, raioCanto: 5 }), 48);
  const ico = montarIco([
    { tamanho: 16, buffer: fav16 },
    { tamanho: 32, buffer: fav32 },
    { tamanho: 48, buffer: fav48 },
  ]);
  writeFileSync(path.join(appDir, "favicon.ico"), ico);

  console.log("Ícones gerados:");
  console.log("  public/icon-192.png");
  console.log("  public/icon-512.png");
  console.log("  public/icon-maskable-512.png");
  console.log("  public/apple-touch-icon.png");
  console.log("  app/favicon.ico");
}

main();
