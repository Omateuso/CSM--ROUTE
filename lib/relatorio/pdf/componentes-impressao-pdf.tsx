import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ReactNode } from "react";

// Equivalente em react-pdf de componentes-impressao.tsx — mesma paleta/
// hierarquia visual, mas react-pdf tem motor de layout próprio (Yoga),
// sem <table>/CSS de verdade, então a API muda: Tabela aqui recebe linhas
// como array de valores, não JSX <tr> cru como a versão HTML.
const TEAL = "#008a83";
const RED = "#d22b1c";
const TINTA = "#1c1917";
const TINTA_SUAVE = "#57534e";
const LINHA = "#e2ded9";

export const pdfStyles = StyleSheet.create({
  secao: { marginBottom: 16 },
  secaoTitulo: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: TINTA,
    borderBottomWidth: 1,
    borderBottomColor: TEAL,
    paddingBottom: 3,
    marginBottom: 2,
  },
  secaoSubtitulo: { fontSize: 8, color: TINTA_SUAVE, marginBottom: 8 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 },
  stat: {
    borderWidth: 1,
    borderColor: LINHA,
    borderRadius: 2,
    padding: 8,
    minWidth: 110,
    flexGrow: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  statDestaque: { borderColor: RED },
  statLabel: { fontSize: 7, letterSpacing: 0.5, color: TINTA_SUAVE },
  statValor: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 3, color: TINTA },
  statValorDestaque: { color: RED },

  linhaCabecalho: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: TINTA,
    borderBottomWidth: 1,
    borderBottomColor: TINTA,
    paddingVertical: 3,
  },
  linha: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINHA, paddingVertical: 3 },
  celulaCabecalho: { flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", color: TINTA_SUAVE },
  celula: { flex: 1, fontSize: 8, color: TINTA },

  semDados: { fontSize: 8, color: TINTA_SUAVE, fontStyle: "italic" },
});

export function SecaoRelatorioPdf({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <View style={pdfStyles.secao} wrap={false}>
      <Text style={pdfStyles.secaoTitulo}>{titulo}</Text>
      {subtitulo && <Text style={pdfStyles.secaoSubtitulo}>{subtitulo}</Text>}
      {children}
    </View>
  );
}

export function GradeStatsPdf({ children }: { children: ReactNode }) {
  return <View style={pdfStyles.statGrid}>{children}</View>;
}

export function StatPdf({ label, valor, destaque }: { label: string; valor: string | number; destaque?: boolean }) {
  return (
    <View style={destaque ? [pdfStyles.stat, pdfStyles.statDestaque] : pdfStyles.stat}>
      <Text style={pdfStyles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={destaque ? [pdfStyles.statValor, pdfStyles.statValorDestaque] : pdfStyles.statValor}>{valor}</Text>
    </View>
  );
}

export function TabelaPdf({ colunas, linhas }: { colunas: string[]; linhas: (string | number)[][] }) {
  return (
    <View>
      <View style={pdfStyles.linhaCabecalho}>
        {colunas.map((coluna, indice) => (
          <Text key={indice} style={pdfStyles.celulaCabecalho}>
            {coluna}
          </Text>
        ))}
      </View>
      {linhas.map((linha, indiceLinha) => (
        <View key={indiceLinha} style={pdfStyles.linha} wrap={false}>
          {linha.map((valor, indiceColuna) => (
            <Text key={indiceColuna} style={pdfStyles.celula}>
              {String(valor)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function SemDadosPdf({ children }: { children: ReactNode }) {
  return <Text style={pdfStyles.semDados}>{children}</Text>;
}
