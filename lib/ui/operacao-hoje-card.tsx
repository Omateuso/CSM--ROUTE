import Link from "next/link";
import styles from "./operacao-hoje-card.module.css";

// Compartilhado entre Dashboard ("Operação de hoje", só exibição) e
// Validação (25/08/2026 — mesmo layout, mas clicável: cada card navega
// pra âncora da listagem correspondente na própria página). `href`
// opcional decide se vira <Link> ou <div> estático.
export function OperacaoHojeCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const conteudo = (
    <>
      <p className={styles.label}>{label}</p>
      <p className={styles.valor}>{value}</p>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={styles.card}>
        {conteudo}
      </Link>
    );
  }

  return <div className={styles.card}>{conteudo}</div>;
}
