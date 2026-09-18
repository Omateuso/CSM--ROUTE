// Selo "Atualizado" compartilhado (18/09/2026; texto trocado de "Ao vivo"
// a pedido do usuário no mesmo dia) — antes cada tela com Realtime
// repetia o mesmo markup. Pílula com ponto que pulsa enquanto conectado
// (classe `live-dot`, app/globals.css; parada em prefers-reduced-motion) e
// vazio/cinza enquanto conecta. `role="status"` anuncia a mudança.
export function IndicadorAoVivo({ conectado, compacto = false }: { conectado: boolean; compacto?: boolean }) {
  return (
    <span
      role="status"
      title={
        conectado
          ? "Esta tela atualiza sozinha quando algo muda — não precisa recarregar."
          : "Conectando… o que está na tela pode estar defasado."
      }
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface font-medium text-text-secondary ${
        compacto ? "h-6 px-2 text-[11px]" : "h-6 px-2.5 text-xs"
      }`}
    >
      <span
        className={`h-[7px] w-[7px] rounded-full ${
          conectado ? "live-dot bg-sla-dentro" : "border border-text-tertiary"
        }`}
        aria-hidden="true"
      />
      {conectado ? "Atualizado" : "Conectando…"}
    </span>
  );
}
