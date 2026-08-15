export function StatusBadge({ ativo }: { ativo: boolean }) {
  if (ativo) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
        <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary" aria-hidden="true" />
        Ativa
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-1.5 py-0.5 text-xs text-text-secondary">
      <span className="h-1.5 w-1.5 rounded-full border border-text-secondary" aria-hidden="true" />
      Inativa
    </span>
  );
}
