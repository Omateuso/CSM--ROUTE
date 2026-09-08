import ExcelJS from "exceljs";
import { CORES } from "./csm";
import type { ServicoRelatorio } from "./tipos";

// ANEXO 1 — a planilha que a CSM entrega hoje montada à mão. Mesmas 5 colunas
// (OS · DATA · RT · CAPS VINCULADO · SERVIÇO REALIZADO) pra não quebrar a
// comparação com meses anteriores, MAIS uma 6ª ("SERVIÇO EXECUTADO") ao lado:
// hoje "SERVIÇO REALIZADO" traz o problema (chamados.assunto) e o que foi de
// fato feito só existe manuscrito na OS — aqui os dois campos ficam separados
// (seção 7 do prompt).
//
// Diferenças esperadas vs. a planilha manual de julho: duplicatas e a data com
// ano errado SOMEM (número de chamado é chave, data é timestamp). Qualquer
// outra diferença é bug (checklist, seção 13).

export async function montarXlsxAnexo1(servicos: ServicoRelatorio[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CSM ROUTE";
  wb.created = new Date();

  const ws = wb.addWorksheet("ANEXO 1", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = [
    { header: "OS", key: "os", width: 12 },
    { header: "DATA", key: "data", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "RT", key: "rt", width: 52 },
    { header: "CAPS VINCULADO", key: "caps", width: 40 },
    { header: "SERVIÇO REALIZADO", key: "problema", width: 46 },
    { header: "SERVIÇO EXECUTADO (detalhamento)", key: "executado", width: 62 },
  ];

  const header = ws.getRow(1);
  header.height = 22;
  header.font = { bold: true, color: { argb: `FF${CORES.branco}` }, size: 11 };
  header.alignment = { vertical: "middle", horizontal: "left" };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${CORES.laranja}` } };
  });

  for (const s of servicos) {
    ws.addRow({
      os: s.protocolo,
      data: s.concluidoEm ? new Date(s.concluidoEm) : null,
      rt: `${s.rtCodigo} — ${s.rtEndereco}${s.rtBairro ? `, ${s.rtBairro}` : ""}`,
      caps: s.capsNome,
      problema: s.assunto,
      executado: s.servicoExecutado,
    });
  }

  const ultimaLinha = servicos.length + 1;
  ws.autoFilter = { from: "A1", to: `F${ultimaLinha}` };

  ws.eachRow((row, n) => {
    if (n === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell((cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: `FF${CORES.cinzaClaro}` } } };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
