'use client';

import * as React from 'react';
import { cn } from './cn';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

/**
 * Checkbox — a real input kept in the accessibility tree (`sr-only`, not
 * `hidden`), with the box drawn by a sibling styled off `peer-checked`.
 * Keyboard, form submission, and screen-reader behaviour are the browser's.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const generatedId = React.useId();
    const checkboxId = id ?? generatedId;

    return (
      <label
        htmlFor={checkboxId}
        className={cn('inline-flex cursor-pointer items-center gap-2.5', className)}
      >
        <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className="peer sr-only"
            {...props}
          />
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-0 rounded-sm border-[1.5px] border-line bg-parch-50',
              'transition-all duration-fast ease-brand',
              'peer-checked:border-bench peer-checked:bg-bench',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-parch',
              'peer-disabled:opacity-50',
            )}
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            className={cn(
              'pointer-events-none relative h-3 w-3 scale-75 opacity-0',
              'transition-all duration-fast ease-brand',
              'text-parch-50 peer-checked:scale-100 peer-checked:opacity-100',
            )}
          >
            <path
              d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        {label ? <span className="text-sm text-ink">{label}</span> : null}
      </label>
    );
  },
);
Checkbox.displayName = 'Checkbox';
