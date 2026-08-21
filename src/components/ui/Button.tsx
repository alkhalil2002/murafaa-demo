import * as React from 'react';
import { cn } from './cn';
import { variants, type VariantProps } from './variants';

/**
 * Button — same API as Alkhalil's, dressed in Murafaa's palette.
 *
 * `bench` is the default: the platform green is the voice of the product.
 * `advocate` is reserved for destructive/opposing actions, matching how the
 * maroon reads elsewhere in the app.
 */
const buttonVariants = variants(
  [
    'inline-flex items-center justify-center gap-2',
    'font-medium select-none rounded-md',
    'border-[1.5px] border-transparent',
    'transition-all duration-base ease-brand',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-parch',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-bench text-parch-50 hover:bg-bench-2 hover:-translate-y-0.5 hover:shadow-bench',
        gold: 'bg-gold text-ink hover:brightness-95 hover:-translate-y-0.5 hover:shadow-gold',
        secondary: 'bg-parch-200 text-ink hover:bg-parch-300',
        outline: 'bg-transparent text-bench border-bench hover:bg-bench hover:text-parch-50',
        danger: 'bg-advocate text-parch-50 hover:bg-advocate-2 hover:-translate-y-0.5',
        ghost: 'bg-transparent text-ink hover:bg-parch-200',
        link: 'bg-transparent text-bench underline-offset-4 hover:underline',
      },
      size: {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<{
      variant: Record<
        'primary' | 'gold' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'link',
        string
      >;
      size: Record<'sm' | 'md' | 'lg' | 'icon', string>;
    }> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
