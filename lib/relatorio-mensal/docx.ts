import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  SectionType,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { SupabaseServerClient } from "@/lib/relatorio/types";
import { CLIENTE, CORES, CSM_INSTITUCIONAL } from "./csm";
import { evidenciaParaQuadro, fotoCapaCircular, logoDimensionado, mapComLimite, type ImagemQuadro } from "./imagens";
import { formatarData, formatarIntervalo, rotularMes } from "./periodo";
import type { FiltroRelatorioMensal, ResumoPeriodo, ServicoRelatorio } from "./tipos";

// ---------------------------------------------------------------------------
// Geometria (twips: 1 pt = 20, 1 px @96dpi = 15, 1 cm = 566.93)
// ---------------------------------------------------------------------------
const PX = 15;
const A4 = { width: 11906, height: 16838 };
const MARGEM_PADRAO = 1134; // 2 cm
const MARGEM_CAPA = 851; // 1,5 cm — capa respira mais
const LARGURA_CONTEUDO = A4.width - MARGEM_PADRAO * 2; // 9638 twips ≈ 642 px

const QUADRO_OS = { largura: 620, altura: 240 };
const QUADRO_FOTO = { largura: 300, altura: 220 };
const CIRCULO_CAPA = 300;

const SEM_BORDA = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const SEM_BORDAS = {
  top: SEM_BORDA,
  bottom: SEM_BORDA,
  left: SEM_BORDA,
  right: SEM_BORDA,
  insideHorizontal: SEM_BORDA,
  insideVertical: SEM_BORDA,
} as const;
const LINHA_FINA = { style: BorderStyle.SINGLE, size: 2, color: CORES.cinzaClaro } as const;

// ---------------------------------------------------------------------------
// Blocos de texto reutilizáveis
// ---------------------------------------------------------------------------
function microRotulo(texto: string): Paragraph {
  // Nunca num cinza apagado: a revisão de layout pegou "contraste insuficiente
  // pra impressão" nos primeiros rascunhos — aqui é cinza médio + bold.
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: texto.toUpperCase(), bold: true, size: 15, color: CORES.cinzaMedio, characterSpacing: 24 }),
    ],
  });
}

function valor(texto: string, opcoes: { size?: number; bold?: boolean } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: texto, size: opcoes.size ?? 22, bold: opcoes.bold, color: CORES.grafite })],
  });
}

function regraLaranja(): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: CORES.laranja, space: 1 } },
  });
}

function quadroImagem(imagem: ImagemQuadro | null, rotuloVazio: string, box: { largura: number; altura: number }): Table {
  const conteudo: Paragraph = imagem
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({ type: imagem.tipo, data: imagem.data, transformation: { width: imagem.largura, height: imagem.altura } }),
        ],
      })
    : new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: box.altura * PX * 0.4 },
        children: [new TextRun({ text: rotuloVazio, size: 16, color: CORES.cinzaMedio, allCaps: true })],
      });

  return new Table({
    width: { size: box.largura * PX, type: WidthType.DXA },
    borders: {
      top: LINHA_FINA,
      bottom: LINHA_FINA,
      left: LINHA_FINA,
      right: LINHA_FINA,
      insideHorizontal: SEM_BORDA,
      insideVertical: SEM_BORDA,
    },
    rows: [
      new TableRow({
        height: { value: box.altura * PX + 30, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            shading: imagem ? undefined : { type: ShadingType.SOLID, color: "auto", fill: CORES.quadroFundo },
            children: [conteudo],
          }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Seção 1 — Capa
// ---------------------------------------------------------------------------
function secaoCapa(args: {
  mesRotulo: string;
  intervaloTexto: string;
  nf: string;
  logo: ImagemQuadro;
  fotoCapa: ImagemQuadro | null;
}) {
  const { mesRotulo, intervaloTexto, nf, logo, fotoCapa } = args;

  const cartaoEscuro = new Table({
    width: { size: A4.width - MARGEM_CAPA * 2, type: WidthType.DXA },
    borders: SEM_BORDAS,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, color: "auto", fill: CORES.grafite },
            margins: { top: 640, bottom: 640, left: 560, right: 560 },
            children: [
              new Paragraph({
                spacing: { after: 320 },
                children: [
                  new TextRun({ text: "RELATÓRIO MENSAL", bold: true, size: 18, color: CORES.laranja, characterSpacing: 40 }),
                  new TextRun({ text: ` ${mesRotulo.toUpperCase()}`, size: 18, color: CORES.cinzaClaro, characterSpacing: 24 }),
                ],
              }),
              new Paragraph({
                spacing: { after: 200 },
                children: [new TextRun({ text: "Serviços de manutenção predial", bold: true, size: 60, color: CORES.branco })],
              }),
              new Paragraph({
                spacing: { after: 140 },
                children: [new TextRun({ text: CLIENTE.descricao, size: 24, color: CORES.cinzaClaro })],
              }),
              new Paragraph({
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: `Cliente: ${CLIENTE.nome}   |   Nota fiscal: ${nf || "[N° DA NF]"}   |   Período: ${intervaloTexto}`,
                    size: 17,
                    color: CORES.cinzaMedio,
                  }),
                ],
              }),
              ...(fotoCapa
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 480 },
                      children: [
                        new ImageRun({
                          type: fotoCapa.tipo,
                          data: fotoCapa.data,
                          transformation: { width: fotoCapa.largura, height: fotoCapa.altura },
                        }),
                      ],
                    }),
                  ]
                : []),
            ],
          }),
        ],
      }),
    ],
  });

  return {
    properties: { page: { size: A4, margin: { top: MARGEM_CAPA, right: MARGEM_CAPA, bottom: MARGEM_CAPA, left: MARGEM_CAPA } } },
    children: [
      cartaoEscuro,
      regraLaranja(),
      new Paragraph({
        spacing: { before: 200, after: 200 },
        children: [new ImageRun({ type: logo.tipo, data: logo.data, transformation: { width: logo.largura, height: logo.altura } })],
      }),
      new Paragraph({ children: [new TextRun({ text: CSM_INSTITUCIONAL.endereco, size: 17, color: CORES.cinzaTexto })] }),
      new Paragraph({ children: [new TextRun({ text: CSM_INSTITUCIONAL.cidadeUfCep, size: 17, color: CORES.cinzaTexto })] }),
      new Paragraph({
        spacing: { after: 260 },
        children: [new TextRun({ text: CSM_INSTITUCIONAL.contato, size: 17, color: CORES.cinzaTexto })],
      }),
      microRotulo("Certificações"),
      new Table({
        width: { size: A4.width - MARGEM_CAPA * 2, type: WidthType.DXA },
        borders: {
          top: LINHA_FINA,
          bottom: LINHA_FINA,
          left: LINHA_FINA,
          right: LINHA_FINA,
          insideHorizontal: LINHA_FINA,
          insideVertical: LINHA_FINA,
        },
        rows: [
          new TableRow({
            height: { value: 1100, rule: HeightRule.ATLEAST },
            children: CSM_INSTITUCIONAL.certificacoes.map(
              (cert) =>
                new TableCell({
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: cert.toUpperCase(), size: 16, color: CORES.cinzaMedio, characterSpacing: 20 })],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: "[arquivo do selo]", size: 14, color: CORES.cinzaClaro })],
                    }),
                  ],
                }),
            ),
          }),
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Seção 2 — Folha de rosto
// ---------------------------------------------------------------------------
function cabecalhoInterno(logo: ImagemQuadro, direita: string): Header {
  return new Header({
    children: [
      new Table({
        width: { size: LARGURA_CONTEUDO, type: WidthType.DXA },
        columnWidths: [LARGURA_CONTEUDO * 0.4, LARGURA_CONTEUDO * 0.6],
        borders: {
          ...SEM_BORDAS,
          bottom: { style: BorderStyle.SINGLE, size: 18, color: CORES.laranja },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 0, bottom: 80, left: 0, right: 0 },
                children: [
                  new Paragraph({
                    children: [
                      new ImageRun({ type: logo.tipo, data: logo.data, transformation: { width: logo.largura, height: logo.altura } }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 0, bottom: 80, left: 0, right: 0 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: direita.toUpperCase(), bold: true, size: 16, color: CORES.cinzaTexto, characterSpacing: 24 })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function rodapeInterno(direita: string, comPagina: boolean): Footer {
  const runDireita = comPagina
    ? [new TextRun({ text: "Página ", size: 15, color: CORES.cinzaMedio, characterSpacing: 16 }), new TextRun({ children: [PageNumber.CURRENT], size: 15, color: CORES.cinzaMedio })]
    : [new TextRun({ text: direita.toUpperCase(), size: 15, color: CORES.cinzaMedio, characterSpacing: 16 })];

  return new Footer({
    children: [
      new Table({
        width: { size: LARGURA_CONTEUDO, type: WidthType.DXA },
        columnWidths: [LARGURA_CONTEUDO * 0.6, LARGURA_CONTEUDO * 0.4],
        borders: { ...SEM_BORDAS, top: LINHA_FINA },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                margins: { top: 80, bottom: 0, left: 0, right: 0 },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: CSM_INSTITUCIONAL.nomeFantasia.toUpperCase(), size: 15, color: CORES.cinzaMedio, characterSpacing: 16 })],
                  }),
                ],
              }),
              new TableCell({
                margins: { top: 80, bottom: 0, left: 0, right: 0 },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: runDireita })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function celulaStat(numero: string, rotulo: string): TableCell {
  return new TableCell({
    margins: { top: 260, bottom: 240, left: 0, right: 200 },
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 20, color: CORES.laranja, space: 6 } },
        spacing: { before: 120, after: 120 },
      }),
      new Paragraph({ children: [new TextRun({ text: numero, bold: true, size: 92, color: CORES.grafite })] }),
      new Paragraph({
        spacing: { before: 80 },
        children: [new TextRun({ text: rotulo.toUpperCase(), size: 17, color: CORES.cinzaTexto, characterSpacing: 24 })],
      }),
    ],
  });
}

function secaoFolhaDeRosto(args: { logo: ImagemQuadro; mesRotulo: string; intervaloTexto: string; nf: string; resumo: ResumoPeriodo }) {
  const { logo, mesRotulo, intervaloTexto, nf, resumo } = args;

  const TOP_CAPS = 5;
  const topCaps = resumo.porCaps.slice(0, TOP_CAPS);
  const demais = resumo.porCaps.slice(TOP_CAPS).reduce((acc, c) => acc + c.total, 0);

  const linhaCaps = (nome: string, total: number, forte: boolean) =>
    new TableRow({
      children: [
        new TableCell({
          borders: { ...SEM_BORDAS, bottom: LINHA_FINA },
          margins: { top: 140, bottom: 140, left: 0, right: 0 },
          children: [new Paragraph({ children: [new TextRun({ text: nome, size: 21, color: forte ? CORES.grafite : CORES.cinzaTexto, bold: forte })] })],
        }),
        new TableCell({
          borders: { ...SEM_BORDAS, bottom: LINHA_FINA },
          margins: { top: 140, bottom: 140, left: 0, right: 0 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: String(total), bold: true, size: 24, color: CORES.grafite })] })],
        }),
      ],
    });

  return {
    properties: { type: SectionType.NEXT_PAGE, page: { size: A4, margin: { top: 1418, right: MARGEM_PADRAO, bottom: 1276, left: MARGEM_PADRAO } } },
    headers: { default: cabecalhoInterno(logo, `Relatório mensal · ${mesRotulo}`) },
    footers: { default: rodapeInterno(CSM_INSTITUCIONAL.nomeFantasia, true) },
    children: [
      new Paragraph({ spacing: { before: 400, after: 80 }, children: [new TextRun({ text: "CLIENTE", bold: true, size: 18, color: CORES.cinzaMedio, characterSpacing: 40 })] }),
      new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: CLIENTE.nome, bold: true, size: 52, color: CORES.grafite })] }),
      valor(CSM_INSTITUCIONAL.razaoSocial, { size: 22 }),
      valor(`CNPJ ${CSM_INSTITUCIONAL.cnpj}`, { size: 22 }),
      valor(`Contrato ${CSM_INSTITUCIONAL.contrato} · Nota fiscal ${nf || "[N° DA NF]"}`, { size: 22 }),
      valor(`Período: ${intervaloTexto}`, { size: 22 }),

      new Paragraph({ spacing: { before: 520, after: 60 }, children: [new TextRun({ text: "O PERÍODO EM NÚMEROS", bold: true, size: 18, color: CORES.cinzaMedio, characterSpacing: 40 })] }),
      new Table({
        width: { size: LARGURA_CONTEUDO, type: WidthType.DXA },
        columnWidths: [LARGURA_CONTEUDO / 3, LARGURA_CONTEUDO / 3, LARGURA_CONTEUDO / 3],
        borders: { ...SEM_BORDAS, top: LINHA_FINA, bottom: LINHA_FINA },
        rows: [
          new TableRow({
            children: [
              celulaStat(String(resumo.totalServicos), "Serviços executados"),
              celulaStat(String(resumo.totalRts), "Residências atendidas"),
              celulaStat(String(resumo.totalCaps), "CAPS vinculados"),
            ],
          }),
        ],
      }),

      new Paragraph({ spacing: { before: 520, after: 120 }, children: [new TextRun({ text: "DISTRIBUIÇÃO POR CAPS", bold: true, size: 18, color: CORES.cinzaMedio, characterSpacing: 40 })] }),
      new Table({
        width: { size: LARGURA_CONTEUDO, type: WidthType.DXA },
        columnWidths: [LARGURA_CONTEUDO * 0.82, LARGURA_CONTEUDO * 0.18],
        borders: SEM_BORDAS,
        rows: [
          ...topCaps.map((c) => linhaCaps(c.nome, c.total, false)),
          ...(demais > 0 ? [linhaCaps("Demais CAPS", demais, false)] : []),
          linhaCaps("Total", resumo.totalServicos, true),
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Seções 3..N — uma por serviço
// ---------------------------------------------------------------------------
type ServicoComImagens = ServicoRelatorio & {
  osImg: ImagemQuadro | null;
  antesImg: ImagemQuadro | null;
  depoisImg: ImagemQuadro | null;
};

function celulaCampo(rotulo: string, texto: string, colspan?: number): TableCell {
  return new TableCell({
    columnSpan: colspan,
    margins: { top: 100, bottom: 100, left: 0, right: 200 },
    children: [microRotulo(rotulo), valor(texto)],
  });
}

function secaoServico(logo: ImagemQuadro, mesRotulo: string, s: ServicoComImagens) {
  return {
    properties: { type: SectionType.NEXT_PAGE, page: { size: A4, margin: { top: 1276, right: MARGEM_PADRAO, bottom: 1191, left: MARGEM_PADRAO } } },
    headers: { default: cabecalhoInterno(logo, `${CLIENTE.descricao} · ${mesRotulo}`) },
    footers: { default: rodapeInterno(`Chamado ${s.protocolo}`, false) },
    children: [
      new Paragraph({
        spacing: { before: 240, after: 60 },
        children: [
          new TextRun({ text: "CHAMADO  ", bold: true, size: 18, color: CORES.cinzaMedio, characterSpacing: 40 }),
          new TextRun({ text: s.protocolo, bold: true, size: 52, color: CORES.grafite }),
        ],
      }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: s.assunto, size: 26, color: CORES.grafite })] }),

      new Table({
        width: { size: LARGURA_CONTEUDO, type: WidthType.DXA },
        columnWidths: [LARGURA_CONTEUDO / 2, LARGURA_CONTEUDO / 2],
        borders: SEM_BORDAS,
        rows: [
          new TableRow({
            children: [
              celulaCampo("Data do atendimento", formatarData(s.concluidoEm)),
              celulaCampo("Residência", s.rtCodigo),
            ],
          }),
          new TableRow({
            children: [
              celulaCampo("Endereço", `${s.rtEndereco}${s.rtBairro ? `, ${s.rtBairro}` : ""}`),
              celulaCampo("CAPS vinculado", s.capsNome),
            ],
          }),
          new TableRow({ children: [celulaCampo("Serviço executado", s.servicoExecutado, 2)] }),
        ],
      }),

      new Paragraph({ spacing: { before: 120, after: 200 }, border: { bottom: LINHA_FINA } }),

      microRotulo("Ordem de serviço assinada"),
      quadroImagem(s.osImg, "[imagem da OS]", QUADRO_OS),

      new Paragraph({ spacing: { before: 240 } }),
      new Table({
        width: { size: LARGURA_CONTEUDO, type: WidthType.DXA },
        columnWidths: [LARGURA_CONTEUDO / 2, LARGURA_CONTEUDO / 2],
        borders: SEM_BORDAS,
        rows: [
          new TableRow({
            children: [
              new TableCell({ margins: { top: 0, bottom: 0, left: 0, right: 120 }, children: [microRotulo("Antes"), quadroImagem(s.antesImg, "[foto]", QUADRO_FOTO)] }),
              new TableCell({ margins: { top: 0, bottom: 0, left: 120, right: 0 }, children: [microRotulo("Depois"), quadroImagem(s.depoisImg, "[foto]", QUADRO_FOTO)] }),
            ],
          }),
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------
export async function montarDocxRelatorio(
  supabase: SupabaseServerClient,
  args: { filtro: FiltroRelatorioMensal; nf: string; servicos: ServicoRelatorio[]; resumo: ResumoPeriodo },
): Promise<Buffer> {
  const { filtro, nf, servicos, resumo } = args;

  const mesRotulo = rotularMes(filtro.inicio.slice(0, 7));
  const intervaloTexto = formatarIntervalo(filtro.inicio, filtro.fim);

  const logoBuffer = readFileSync(join(process.cwd(), "public", "relatorio-mensal", "csm-logo.png"));
  const capaBuffer = readFileSync(join(process.cwd(), "public", "relatorio-mensal", "capa-obra.jpg"));

  const [logoCapa, logoInterno, fotoCapa] = await Promise.all([
    logoDimensionado(logoBuffer, 150),
    logoDimensionado(logoBuffer, 92),
    fotoCapaCircular(capaBuffer, CIRCULO_CAPA),
  ]);

  // Imagens das evidências — 3 por serviço, com limite de concorrência.
  const comImagens: ServicoComImagens[] = await mapComLimite(servicos, 8, async (s) => {
    const [osImg, antesImg, depoisImg] = await Promise.all([
      evidenciaParaQuadro(supabase, s.osPath, QUADRO_OS),
      evidenciaParaQuadro(supabase, s.fotoAntesPath, QUADRO_FOTO),
      evidenciaParaQuadro(supabase, s.fotoDepoisPath, QUADRO_FOTO),
    ]);
    return { ...s, osImg, antesImg, depoisImg };
  });

  const doc = new Document({
    creator: "CSM ROUTE",
    title: `Relatório mensal CSM — ${mesRotulo}`,
    description: `Serviços de manutenção predial validados · ${intervaloTexto}`,
    sections: [
      secaoCapa({ mesRotulo, intervaloTexto, nf, logo: logoCapa, fotoCapa }),
      secaoFolhaDeRosto({ logo: logoInterno, mesRotulo, intervaloTexto, nf, resumo }),
      ...comImagens.map((s) => secaoServico(logoInterno, mesRotulo, s)),
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
