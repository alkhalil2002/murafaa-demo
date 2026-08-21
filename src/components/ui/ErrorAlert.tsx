import * as React from 'react';
import { cn } from './cn';

export interface ErrorAlertProps {
  title?: string;
  message: string;
  /** Retry / dismiss control. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Inline error banner. `role="alert"` so screen readers announce it when it
 * appears mid-flow. Copy arrives already translated — see EmptyState.
 */
export function ErrorAlert({ title, message, action, className }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4',
        'border-advocate/30 bg-advocate/5 text-ink',
        className,
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="mt-0.5 h-5 w-5 shrink-0 text-advocate"
      >
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M10 6v5M10 13.6v.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex-1">
        {title ? <p className="mb-1 font-semibold text-advocate">{title}</p> : null}
        <p className="text-sm leading-normal">{message}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
