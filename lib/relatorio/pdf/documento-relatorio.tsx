import fs from "node:fs";
import path from "node:path";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ReactNode } from "react";

// Timbrado real (docs/referencias/timbrado-igedes.docx → image1.png), mesmas cores por amostragem de
// pixel já usadas no preview HTML (lib/relatorio/relatorio-print.module.css).
// Cabeçalho/marca-d'água/rodapé usam a prop `fixed` do react-pdf — repete
// em toda página automaticamente, sem os problemas de empilhamento que a
// versão HTML teve (motor de layout próprio do react-pdf, não é o DOM/CSS
// do navegador).
const TEAL = "#0b6e68";
const TINTA_SUAVE = "#57534e";

const styles = StyleSheet.create({
  page: {
    paddingTop: 92,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  marcaDagua: {
    position: "absolute",
    top: 260,
    left: "50%",
    width: 340,
    marginLeft: -170,
    opacity: 0.3,
  },
  cabecalho: {
    position: "absolute",
    top: 26,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { width: 100 },
  tituloBloco: { alignItems: "flex-end" },
  tituloH1: { fontSize: 13, fontFamily: "Helvetica-Bold", color: TEAL },
  tituloP: { fontSize: 8, color: TINTA_SUAVE, marginTop: 2 },
  rodape: { position: "absolute", bottom: 0, left: 0, right: 0 },
  rodapeBarra: {
    backgroundColor: TEAL,
    color: "#fff",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 4,
    paddingHorizontal: 44,
  },
  rodapeTexto: {
    fontSize: 7,
    color: TINTA_SUAVE,
    paddingHorizontal: 44,
    paddingTop: 4,
    paddingBottom: 6,
    lineHeight: 1.4,
  },
  resumoExecutivo: {
    marginBottom: 16,
    padding: 10,
    borderLeftWidth: 2,
    borderLeftColor: TEAL,
    backgroundColor: "#f4faf9",
    fontSize: 9.5,
    lineHeight: 1.5,
  },
  resumoLabel: { fontFamily: "Helvetica-Bold", color: TEAL },
});

function lerAssetPdf(nomeArquivo: string): Buffer {
  return fs.readFileSync(path.join(process.cwd(), "public", "relatorio", nomeArquivo));
}

export function DocumentoRelatorio({
  geradoEm,
  periodoTexto,
  resumo,
  children,
}: {
  geradoEm: string;
  periodoTexto: string;
  resumo: string;
  children: ReactNode;
}) {
  return (
    <Document title="Relatório de operação — CSM ROUTE">
      <Page size="A4" style={styles.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- falso positivo: este <Image> é do react-pdf (renderiza dentro do PDF, motor de layout próprio), não next/image/<img> — a regra casa só pelo nome do componente, e react-pdf nem tem prop `alt` na API. */}
        <Image src={lerAssetPdf("marca-dagua-igedes.png")} style={styles.marcaDagua} fixed />

        <View style={styles.cabecalho} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- mesmo motivo do watermark acima. */}
          <Image src={lerAssetPdf("logo-igedes-completo.png")} style={styles.logo} />
          <View style={styles.tituloBloco}>
            <Text style={styles.tituloH1}>Relatório de operação — CSM ROUTE</Text>
            <Text style={styles.tituloP}>
              Gerado em {geradoEm}
              {periodoTexto}
            </Text>
          </View>
        </View>

        <View style={styles.rodape} fixed>
          <Text style={styles.rodapeBarra}>
            IGEDES - Instituto de Gestão e Desenvolvimento | CNPJ: 05.696.218/0001-46
          </Text>
          <Text style={styles.rodapeTexto}>
            Avenida das Américas, 3500 - Bloco 7, Sl 704 - Barra da Tijuca, Rio de Janeiro-RJ | CEP: 22640-102{"\n"}
            Tel. (21) 3598-2371 / 3598-2372 | igedes.org.br
          </Text>
        </View>

        {resumo && (
          <View style={styles.resumoExecutivo}>
            <Text>
              <Text style={styles.resumoLabel}>Resumo executivo. </Text>
              {resumo}
            </Text>
          </View>
        )}

        {children}
      </Page>
    </Document>
  );
}
