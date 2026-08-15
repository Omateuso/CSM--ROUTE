"use client";

import { useEffect, useId, useRef, type FormEvent, type MouseEvent, type ReactNode } from "react";

// Casco compartilhado de todo diálogo nativo do app. Resolve 3 coisas que
// o navegador não dá de graça (documentado em .interface-design/system.md):
// aria-labelledby pro título, fechar no clique do backdrop, e
// centralização explícita (Tailwind Preflight zera margin, quebrando o
// `margin: auto` nativo do dialog:modal). Focus trap e retorno de foco já
// vêm de graça do <dialog> nativo.
//
// O componente pai é responsável por remontar via `key` a cada abertura
// (defaultValue/useActionState só aplicam o valor inicial na montagem).
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleCancel(event: FormEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClose={onClose}
      onClick={handleBackdropClick}
      aria-labelledby={titleId}
      className="fixed top-1/2 left-1/2 m-0 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-surface p-0 text-text-primary backdrop:bg-text-primary/40"
    >
      <div className="p-6">
        <h2 id={titleId} className="mb-4 text-base font-semibold text-text-primary">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
