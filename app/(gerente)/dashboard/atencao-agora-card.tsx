import Link from "next/link";
import styles from "./atencao-agora-card.module.css";

// Card ativado só quando há algo pendente (> 0) — o estado "tudo em dia"
// continua o card neutro simples (ver page.tsx), essa animação é
// deliberadamente reservada pra quando existe algo que precisa de atenção.
export function AtencaoAgoraCard({
  total,
  aguardandoValidacao,
  travados,
}: {
  total: number;
  aguardandoValidacao: number;
  travados: number;
}) {
  return (
    <Link href="/validacao" className={styles.card}>
      <div className={styles.front}>
        <p className={styles.label}>Atenção agora</p>
        <p className={styles.valor}>{total}</p>
        <p className={styles.dica}>passe o mouse aqui →</p>
      </div>
      <div className={styles.verso}>
        <p className={styles.versoTitulo}>Atenção agora</p>
        <p className={styles.versoDetalhe}>
          {aguardandoValidacao} aguardando validação · {travados} travados em rota já passada
        </p>
        <p className={styles.versoLink}>Resolver →</p>
      </div>
    </Link>
  );
}
