import * as React from 'react';
import { cn } from './cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'w-full rounded-md bg-parch-50 font-sans text-base text-ink',
          'border-[1.5px] px-4 py-3',
          'outline-none transition-all duration-base ease-brand',
          'placeholder:text-parch-600',
          'focus:border-gold focus:shadow-[0_0_0_4px_rgb(var(--gold-rgb)/0.16)]',
          'disabled:cursor-not-allowed disabled:bg-parch-200 disabled:text-parch-600',
          error ? 'border-advocate' : 'border-line',
          className,
        )}
        aria-invalid={error || undefined}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          'w-full rounded-md bg-parch-50 font-sans text-base leading-normal text-ink',
          'border-[1.5px] px-4 py-3',
          'outline-none transition-all duration-base ease-brand',
          'placeholder:text-parch-600',
          'focus:border-gold focus:shadow-[0_0_0_4px_rgb(var(--gold-rgb)/0.16)]',
          'disabled:cursor-not-allowed disabled:bg-parch-200 disabled:text-parch-600',
          error ? 'border-advocate' : 'border-line',
          className,
        )}
        aria-invalid={error || undefined}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn('mb-2 block text-sm font-medium text-ink', className)}
        {...props}
      >
        {children}
        {/* The asterisk is decorative — `required` on the input is what
            assistive tech announces. */}
        {required ? (
          <span aria-hidden="true" className="ms-1 text-advocate">
            *
          </span>
        ) : null}
      </label>
    );
  },
);
Label.displayName = 'Label';

export interface FieldProps {
  children: React.ReactNode;
  className?: string;
  /** Validation message. Rendered in an assertive live region when present. */
  error?: string;
  /** Static helper text, shown when there is no error. */
  hint?: string;
}

export function Field({ children, className, error, hint }: FieldProps) {
  return (
    <div className={cn('mb-6', className)}>
      {children}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-advocate">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-sm text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}
