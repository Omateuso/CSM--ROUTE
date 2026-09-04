"use client";

import { useId } from "react";
import styles from "./raio-proximidade-picker.module.css";

// Componente visual fornecido pronto pelo usuário (27/08/2026, HTML/CSS
// colado) pra substituir o <select> simples de raio de proximidade —
// mesma convenção de "cor/efeito mantido exatamente como veio" já usada
// pro botão de Pendências e "Iniciar atendimento". Adaptado de 3 pra 5
// opções (raio: 5/10/15/20/25 km, ver RAIO_OPCOES_KM).
export const RAIO_OPCOES_KM = [5, 10, 15, 20, 25];

export function RaioProximidadePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (km: number) => void;
}) {
  const uid = useId();
  const name = `raio-proximidade-${uid}`;

  return (
    <div className={styles.radioInput}>
      <div className={styles.glass}>
        <div className={styles.glassInner} />
      </div>
      <div className={styles.selector}>
        {RAIO_OPCOES_KM.map((km) => {
          const id = `${name}-${km}`;
          return (
            <div key={km} className={styles.choice}>
              <div>
                <input
                  className={styles.choiceCircle}
                  checked={value === km}
                  onChange={() => onChange(km)}
                  value={km}
                  name={name}
                  id={id}
                  type="radio"
                />
                <div className={styles.ball} />
              </div>
              <label htmlFor={id} className={styles.choiceName}>
                {km}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
