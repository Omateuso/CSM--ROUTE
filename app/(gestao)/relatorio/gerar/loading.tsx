// Opt-out deliberado do esqueleto do pai.
//
// `loading.tsx` vale pra todos os segmentos filhos: sem este arquivo, o
// esqueleto de "Relatório diário" (app/(gestao)/relatorio/loading.tsx)
// piscaria por cima do documento timbrado enquanto ele monta — um
// cabeçalho de app dentro de uma folha pronta pra imprimir. Este é o
// documento em si, não uma tela do sistema: ele carrega em branco, como
// qualquer PDF/impressão faria.
export default function Loading() {
  return null;
}
