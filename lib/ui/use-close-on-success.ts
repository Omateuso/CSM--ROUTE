"use client";

import { useEffect, useRef } from "react";

// Fecha o diálogo/form quando uma submissão via useActionState termina
// sem erro. Detecta a transição isPending true -> false (não dá pra
// distinguir "nunca submeteu" de "submeteu com sucesso" só pelo estado
// inicial, por isso rastreia o pending anterior).
export function useCloseOnSuccess(isPending: boolean, error: string | null, onSuccess: () => void) {
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && error === null) {
      onSuccess();
    }
    wasPending.current = isPending;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, error]);
}
