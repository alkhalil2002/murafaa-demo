'use client';

import * as React from 'react';
import { cn } from './cn';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** Already-translated button copy. */
  confirmLabel: string;
  cancelLabel: string;
  /** Destructive actions get the maroon confirm button. */
  tone?: 'default' | 'danger';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Modal confirmation.
 *
 * Built on the native `<dialog>` element so focus trapping, the top layer, and
 * Escape-to-close come from the browser rather than a hand-rolled focus
 * manager. `showModal()` is called in an effect because it is imperative and
 * must not run during render.
 *
 * NOTE: this is deliberately NOT `window.confirm` — a native confirm blocks the
 * event loop and cannot be styled or translated.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = React.useState(false);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Escape fires `cancel` on the element; route it through the same handler so
  // the parent's state stays in sync with what the browser did.
  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (!busy) onCancel();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onCancel, busy]);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        'w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-line bg-parch-50 p-0 text-ink',
        'shadow-xl backdrop:bg-ink/45',
      )}
    >
      <div className="p-6">
        <h2 id={titleId} className="mb-2 font-display text-lg font-semibold text-ink">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="text-sm leading-normal text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          size="sm"
          onClick={handleConfirm}
          loading={busy}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
