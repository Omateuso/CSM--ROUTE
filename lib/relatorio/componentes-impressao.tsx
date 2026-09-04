import type { ReactNode } from "react";
import styles from "./relatorio-print.module.css";

// Primitivos de apresentação compartilhados por todos os blocos do
// catálogo (lib/relatorio/blocos/*.tsx) — cada bloco só monta os dados,
// a aparência impressa vem toda daqui, garantindo que um bloco novo já
// nasça visualmente consistente com os outros 9 sem repetir CSS.

export function SecaoRelatorio({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.secao}>
      <h2 className={styles.secaoTitulo}>{titulo}</h2>
      {subtitulo && <p className={styles.secaoSubtitulo}>{subtitulo}</p>}
      {children}
    </section>
  );
}

export function GradeStats({ children }: { children: ReactNode }) {
  return <div className={styles.statGrid}>{children}</div>;
}

export function Stat({ label, valor, destaque }: { label: string; valor: string | number; destaque?: boolean }) {
  return (
    <div className={destaque ? `${styles.stat} ${styles.statDestaque}` : styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValor}>{valor}</div>
    </div>
  );
}

export function Tabela({ colunas, children }: { colunas: string[]; children: ReactNode }) {
  return (
    <table className={styles.tabela}>
      <thead>
        <tr>
          {colunas.map((coluna) => (
            <th key={coluna} scope="col">
              {coluna}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function SemDados({ children }: { children: ReactNode }) {
  return <p className={styles.semDados}>{children}</p>;
}
