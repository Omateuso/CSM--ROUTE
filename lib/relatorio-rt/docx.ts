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
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { SupabaseServerClient } from "@/lib/relatorio/types";
import { CORES, CSM_INSTITUCIONAL } from "@/lib/relatorio-mensal/csm";
import { baixarDoStorage, bufferParaQuadro, logoDimensionado, type ImagemQuadro } from "@/lib/relatorio-mensal/imagens";
import { formatarData } from "@/lib/relatorio-mensal/periodo";
import type { RelatorioRtParaDocx } from "./tipos";

// Diferente do relatório mensal (1 página por serviço, dezenas/centenas de
// itens), este documento é sempre UM incidente só — corrido, sem seção por
// item, com quebra de página natural do Word. Cabeçalho/rodapé próprios
// (mais simples que os do relatório mensal, que carregam rótulo por
// mês/por chamado que não fazem sentido aqui); reaproveita só a identidade
// visual (cores/logo) de `lib/relatorio-mensal/csm.ts`.

const PX = 15; // 1 px @96dpi ≈ 15 twips
const A4 = { width: 11906, height: 16838 };
const MARGEM = 1134; // 2 cm
const LARGURA_CONTEUDO = A4.width - MARGEM * 2;

const QUADRO_FOTO = { largura: 620, altura: 460 };

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

function microRotulo(texto: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: texto.toUpperCase(), bold: true, size: 15, color: CORES.cinzaMedio, characterSpacing: 24 }),
    ],
  });
}

function valor(texto: string): Paragraph {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text: texto, size: 22, color: CORES.grafite })],
  });
}

function campo(rotulo: string, texto: string): Paragraph[] {
  return [microRotulo(rotulo), valor(texto)];
}

/**
 * Um texto livre digitado pelo usuário vira parágrafos/quebras de linha
 * REAIS — nunca um blob achatado numa TextRun só (o relato precisa
 * preservar a formatação que a pessoa escreveu). Linha em branco dupla
 * separa parágrafos; quebra simples vira quebra de linha dentro do mesmo
 * parágrafo.
 */
function paragrafosDeTexto(texto: string): Paragraph[] {
  const blocos = texto
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  return blocos.map((bloco) => {
    const linhas = bloco.split("\n");
    const runs = linhas.map(
      (linha, indice) =>
        new TextRun({ text: linha, size: 22, color: CORES.grafite, break: indice > 0 ? 1 : undefined }),
    );
    return new Paragraph({ spacing: { after: 200 }, children: runs });
  });
}

function cabecalho(logo: ImagemQuadro): Header {
  return new Header({
    children: [
      new Table({
        width: { size: LARGURA_CONTEUDO, type: WidthType.DXA },
        columnWidths: [LARGURA_CONTEUDO * 0.4, LARGURA_CONTEUDO * 0.6],
        borders: { ...SEM_BORDAS, bottom: { style: BorderStyle.SINGLE, size: 18, color: CORES.laranja } },
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
                    children: [
                      new TextRun({ text: "RELATÓRIO TÉCNICO", bold: true, size: 16, color: CORES.cinzaCabecalho, characterSpacing: 24 }),
                    ],
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

function rodape(): Footer {
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
                    children: [
                      new TextRun({ text: CSM_INSTITUCIONAL.nomeFantasia.toUpperCase(), size: 15, color: CORES.cinzaCabecalho, characterSpacing: 16 }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                margins: { top: 80, bottom: 0, left: 0, right: 0 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({ text: "Página ", size: 15, color: CORES.cinzaCabecalho, characterSpacing: 16 }),
                      new TextRun({ children: [PageNumber.CURRENT], size: 15, color: CORES.cinzaCabecalho }),
                    ],
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

function quadroFoto(imagem: ImagemQuadro | null): Table {
  const conteudo = imagem
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({ type: imagem.tipo, data: imagem.data, transformation: { width: imagem.largura, height: imagem.altura } }),
        ],
      })
    : new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: QUADRO_FOTO.altura * PX * 0.4 },
        children: [new TextRun({ text: "[imagem indisponível]", size: 16, color: CORES.cinzaMedio, allCaps: true })],
      });

  return new Table({
    width: { size: QUADRO_FOTO.largura * PX, type: WidthType.DXA },
    borders: { top: LINHA_FINA, bottom: LINHA_FINA, left: LINHA_FINA, right: LINHA_FINA, insideHorizontal: SEM_BORDA, insideVertical: SEM_BORDA },
    rows: [
      new TableRow({
        height: { value: QUADRO_FOTO.altura * PX + 30, rule: HeightRule.ATLEAST },
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

/** `chamado_id` pode existir com `tomticketId` nulo (ex.: chamado nascido de
 * uma urgência, ainda sem protocolo) — nunca renderiza "undefined"/"#". */
function rotuloChamado(chamado: RelatorioRtParaDocx["chamado"]): string | null {
  if (!chamado) return null;
  return chamado.tomticketId ? `#${chamado.tomticketId}` : chamado.assunto;
}

export async function montarDocxRelatorioRt(
  supabase: SupabaseServerClient,
  relatorio: RelatorioRtParaDocx,
): Promise<Buffer> {
  const logoBuffer = readFileSync(join(process.cwd(), "public", "relatorio-mensal", "csm-logo.png"));
  const logo = await logoDimensionado(logoBuffer, 110);

  const fotos = await Promise.all(
    relatorio.fotos.map(async (f) => {
      const entrada = await baixarDoStorage(supabase, "relatorios-rt", f.storagePath);
      const imagem = entrada ? await bufferParaQuadro(entrada, QUADRO_FOTO) : null;
      return { imagem, legenda: f.legenda };
    }),
  );

  const chamadoRotulo = rotuloChamado(relatorio.chamado);

  const doc = new Document({
    creator: "CSM ROUTE",
    title: `Relatório técnico — ${relatorio.rt.codigo}`,
    description: relatorio.assunto,
    sections: [
      {
        properties: { page: { size: A4, margin: { top: 1276, right: MARGEM, bottom: 1191, left: MARGEM } } },
        headers: { default: cabecalho(logo) },
        footers: { default: rodape() },
        children: [
          new Paragraph({
            spacing: { before: 160, after: 240 },
            children: [new TextRun({ text: "RELATÓRIO TÉCNICO", bold: true, size: 44, color: CORES.grafite })],
          }),

          new Table({
            width: { size: LARGURA_CONTEUDO, type: WidthType.DXA },
            columnWidths: [LARGURA_CONTEUDO / 2, LARGURA_CONTEUDO / 2],
            borders: SEM_BORDAS,
            rows: [
              new TableRow({
                children: [
                  new TableCell({ margins: { top: 0, bottom: 0, left: 0, right: 200 }, children: campo("RT", `${relatorio.rt.codigo} — ${relatorio.rt.nome}`) }),
                  new TableCell({ margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: campo("CAPS vinculado", relatorio.rt.capsNome) }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    margins: { top: 0, bottom: 0, left: 0, right: 200 },
                    children: campo("Endereço", `${relatorio.rt.endereco}${relatorio.rt.bairro ? `, ${relatorio.rt.bairro}` : ""}`),
                  }),
                  new TableCell({ margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: campo("Data", formatarData(relatorio.criadoEm)) }),
                ],
              }),
              new TableRow({
                children: chamadoRotulo
                  ? [
                      new TableCell({ margins: { top: 0, bottom: 0, left: 0, right: 200 }, children: campo("Responsável", relatorio.responsavelNome) }),
                      new TableCell({ margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: campo("Chamado relacionado", chamadoRotulo) }),
                    ]
                  : [
                      new TableCell({ columnSpan: 2, margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: campo("Responsável", relatorio.responsavelNome) }),
                    ],
              }),
            ],
          }),

          new Paragraph({ spacing: { before: 160, after: 240 }, border: { bottom: LINHA_FINA } }),

          microRotulo("Assunto"),
          valor(relatorio.assunto),

          new Paragraph({ spacing: { before: 120, after: 60 }, children: [new TextRun({ text: "RELATO TÉCNICO", bold: true, size: 18, color: CORES.cinzaMedio, characterSpacing: 40 })] }),
          ...paragrafosDeTexto(relatorio.relatoTecnico),

          ...(fotos.length > 0
            ? [
                new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text: "REGISTRO FOTOGRÁFICO", bold: true, size: 18, color: CORES.cinzaMedio, characterSpacing: 40 })] }),
                ...fotos.flatMap((f, indice) => [
                  quadroFoto(f.imagem),
                  ...(f.legenda
                    ? [
                        new Paragraph({
                          spacing: { before: 80, after: 240 },
                          children: [
                            new TextRun({ text: `Figura ${String(indice + 1).padStart(2, "0")} — `, bold: true, size: 18, color: CORES.cinzaTexto }),
                            new TextRun({ text: f.legenda, size: 18, color: CORES.cinzaTexto }),
                          ],
                        }),
                      ]
                    : [new Paragraph({ spacing: { before: 80, after: 240 } })]),
                ]),
              ]
            : []),

          ...(relatorio.encaminhamento
            ? [
                new Paragraph({ spacing: { before: 120, after: 60 }, children: [new TextRun({ text: "INFORMAÇÕES COMPLEMENTARES", bold: true, size: 18, color: CORES.cinzaMedio, characterSpacing: 40 })] }),
                ...paragrafosDeTexto(relatorio.encaminhamento),
              ]
            : []),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
