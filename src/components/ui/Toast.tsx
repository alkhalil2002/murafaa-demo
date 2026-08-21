'use client';

import * as React from 'react';
import { cn } from './cn';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  /** Copy must arrive already translated — pass `t("…")`, not a message key. */
  show: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const TONE_CLASSES: Record<ToastTone, string> = {
  info: 'border-line bg-parch-50 text-ink',
  success: 'border-ok bg-ok/10 text-[#215c43]',
  error: 'border-advocate bg-advocate/10 text-[#8c1c24]',
};

export interface ToastProviderProps {
  children: React.ReactNode;
  /** Auto-dismiss delay in ms. */
  duration?: number;
  /** Accessible name for the toast region, already translated. */
  regionLabel?: string;
  /** Accessible name for each toast's dismiss button, already translated. */
  dismissLabel?: string;
}

export function ToastProvider({
  children,
  duration = 5000,
  regionLabel,
  dismissLabel,
}: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = React.useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, message, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss, duration],
  );

  // Clear pending timers if the provider unmounts mid-flight.
  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // `polite` so a toast never interrupts what the user is reading.
        // Errors that must interrupt belong in <ErrorAlert>, not here.
        aria-live="polite"
        aria-label={regionLabel}
        className="pointer-events-none fixed bottom-6 start-6 z-50 flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-3',
              'animate-toast-in shadow-lg',
              TONE_CLASSES[toast.tone],
            )}
          >
            <span className="text-sm">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={dismissLabel}
              // The glyph is decorative; the button is named by `dismissLabel`,
              // which the caller passes already translated.
              className="ms-auto text-lg leading-none opacity-60 transition-opacity hover:opacity-100"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
