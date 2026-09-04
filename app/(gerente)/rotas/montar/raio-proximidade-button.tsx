"use client";

import styles from "./raio-proximidade-button.module.css";

// Botão-gatilho fornecido pronto pelo usuário (27/08/2026, HTML/CSS
// colado, efeito ripple) — abre o modal com o RaioProximidadePicker
// (que ficou grande demais pra viver fixo na página, ver
// raio-proximidade-picker.module.css). Mostra o valor atual no próprio
// texto do botão — sem isso, o gerente não teria como saber qual raio
// está valendo sem abrir o modal toda vez.
export function RaioProximidadeButton({ raioKm, onClick }: { raioKm: number; onClick: () => void }) {
  return (
    <button type="button" className={styles.btn} onClick={onClick}>
      <i className={styles.animation} aria-hidden="true" />
      Proximidade de rota: {raioKm} km
      <i className={styles.animation} aria-hidden="true" />
    </button>
  );
}
