import { StatusDot } from "@/lib/ui/status-dot";

export function StatusBadge({ ativo }: { ativo: boolean }) {
  if (ativo) {
    return <StatusDot label="Ativa" dotClassName="bg-text-tertiary" textClassName="text-text-tertiary" />;
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border-strong bg-surface-input px-1.5 py-0.5 text-xs text-text-secondary">
      <span className="h-1.5 w-1.5 rounded-full border border-text-secondary" aria-hidden="true" />
      Inativa
    </span>
  );
}
