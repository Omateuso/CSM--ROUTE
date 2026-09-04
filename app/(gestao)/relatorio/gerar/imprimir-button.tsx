"use client";

import { useSearchParams } from "next/navigation";
import styles from "@/lib/relatorio/relatorio-print.module.css";

// Pedido do usuário (27/08/2026): o botão de baixar sempre abria o diálogo
// de impressão do navegador (window.print()) — ele queria só salvar,
// direto. Botão de baixar agora é um link pra app/(gestao)/relatorio/gerar/
// pdf/route.tsx (PDF de verdade, gerado no servidor com react-pdf), com os
// MESMOS parâmetros de busca da página atual — mesmos blocos/período que
// estão na tela. "Imprimir" continua existindo à parte (Ctrl+P / print do
// navegador ainda funciona nessa página, ela já tem @media print pronto),
// só não é mais o botão principal.
//
// Escondido via @media print no próprio module.css — na folha impressa
// fica só o documento, sem esse chrome de tela.
export function ImprimirButton() {
  const searchParams = useSearchParams();
  const hrefPdf = `/relatorio/gerar/pdf?${searchParams.toString()}`;

  return (
    <div className={styles.toolbar}>
      <a href="/relatorio" className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20">
        ← Voltar
      </a>
      <a
        href={hrefPdf}
        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-text-primary hover:bg-white/90"
      >
        Baixar PDF
      </a>
    </div>
  );
}
