import * as React from 'react';
import { cn } from './cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  /** Draw the gold rule on the top edge — Murafaa's signature accent. */
  withRule?: boolean;
}

/**
 * Card — the standard surface.
 *
 * Alkhalil marks its cards with a skewed red slash; Murafaa rules them in gold.
 * The rule sits inside the top border rather than straddling it, so cards can
 * butt against each other in a grid without the accents colliding.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, withRule = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden rounded-lg border border-line bg-parch-50 p-6',
          'transition-all duration-base ease-brand',
          hoverable && 'cursor-pointer hover:-translate-y-1 hover:border-gold hover:shadow-lg',
          className,
        )}
        {...props}
      >
        {withRule ? (
          <span
            aria-hidden="true"
            className="absolute start-6 top-0 h-[3px] w-[60px] rounded-b-full bg-gold"
          />
        ) : null}
        {children}
      </div>
    );
  },
);
Card.displayName = 'Card';

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('font-display text-lg font-semibold text-ink', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('text-sm leading-normal text-ink-soft', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-4 flex items-center justify-between border-t border-line pt-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
