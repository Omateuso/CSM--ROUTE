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
      // `w-[min(32rem,calc(100%-2rem))]` (não `w-full max-w-lg`): num celular
      // mais estreito que 32rem, `w-full` sozinho vencia `max-w-lg` e o
      // diálogo tocava as duas bordas da tela, sem gutter nenhum — todo
      // modal do app usa este componente, então isso valia pra qualquer um
      // deles (confirmar rota, correção, reagendamento, urgência, etc). Pra
      // `position:fixed`, `%` resolve contra o viewport, então `calc(100%-2rem)`
      // já garante 1rem (16px) de respiro de cada lado.
      className="fixed top-1/2 left-1/2 m-0 max-h-[90vh] w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] bg-surface p-0 text-text-primary shadow-lift-overlay backdrop:bg-text-primary/35 backdrop:backdrop-blur-[2px] open:motion-safe:animate-[modal-in_180ms_var(--ease-out)]"
    >
      <div className="p-6">
        <h2 id={titleId} className="mb-4 text-lg font-semibold tracking-[-0.01em] text-text-primary">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
