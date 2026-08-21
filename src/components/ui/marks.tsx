import * as React from 'react';
import { cn } from './cn';

/**
 * Murafaa's signature marks — the counterpart to Alkhalil's DiagonalSlash and
 * FrameCorners primitives.
 *
 * Where Alkhalil signs a surface with a skewed red slash (an architect's mark),
 * Murafaa signs it with document furniture: a ruled gold line and a struck
 * seal. Same structural role, different vocabulary.
 *
 * All marks inherit `currentColor`, so tone is set by the parent's text colour
 * rather than baked in.
 */

/** Award medallion + ribbon — the "struck seal". */
export function SealMark({ size = 46 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* ribbon tails, sitting behind the medallion */}
      <path
        d="M19 32.6 L14.5 44.5 L20.6 41.6 L24 45 L27.4 41.6 L33.5 44.5 L29 32.6 Z"
        fill="currentColor"
        opacity="0.28"
      />
      {/* medallion — outer notched ring reads as a struck seal */}
      <circle
        cx="24"
        cy="21"
        r="14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="2.6 2.2"
        opacity="0.65"
      />
      <circle cx="24" cy="21" r="11" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M24 13.5 L25.88 18.41 L31.13 18.68 L27.04 21.99 L28.41 27.07 L24 24.2 L19.59 27.07 L20.96 21.99 L16.87 18.68 L22.12 18.41 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Balance scale — the case mark. */
export function ScaleMark({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 6v14M8 20h8M3.5 8h17" />
      <path d="M3.5 8 1.4 12.6a3.2 3.2 0 0 0 4.2 0L3.5 8Z" />
      <path d="M20.5 8l-2.1 4.6a3.2 3.2 0 0 0 4.2 0L20.5 8Z" />
      <circle cx="12" cy="4.4" r="1.5" />
    </svg>
  );
}

export interface GoldRuleProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
}

/**
 * The ruled gold line — Murafaa's structural accent, used on card edges and
 * as a section divider. This is the role Alkhalil's DiagonalSlash plays.
 *
 * It is a rule, not a slash: no skew. Paper is ruled straight.
 */
export const GoldRule = React.forwardRef<HTMLSpanElement, GoldRuleProps>(
  ({ size = 'md', className, ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-10 h-0.5',
      md: 'w-[60px] h-[3px]',
      lg: 'w-[120px] h-1',
    };

    return (
      <span
        ref={ref}
        aria-hidden="true"
        className={cn('inline-block rounded-full bg-gold', sizeClasses[size], className)}
        {...props}
      />
    );
  },
);
GoldRule.displayName = 'GoldRule';

export interface FrameCornersProps {
  children?: React.ReactNode;
  className?: string;
  /** Corner arm length in px. */
  size?: number;
  color?: 'bench' | 'gold' | 'ink';
}

/**
 * Document frame corners — wraps forms and pull-quotes so they read as an
 * excerpt from a filing. Direction-aware: the arms swap sides under RTL.
 */
export function FrameCorners({
  children,
  className,
  size = 40,
  color = 'gold',
}: FrameCornersProps) {
  const borderColor = {
    bench: 'border-bench',
    gold: 'border-gold',
    ink: 'border-ink',
  }[color];

  return (
    <div className={cn('relative', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-0 border-t-2',
          'ltr:right-0 ltr:border-r-2 rtl:left-0 rtl:border-l-2',
          borderColor,
        )}
        style={{ width: size, height: size }}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute bottom-0 border-b-2',
          'ltr:left-0 ltr:border-l-2 rtl:right-0 rtl:border-r-2',
          borderColor,
        )}
        style={{ width: size, height: size }}
      />
      {children}
    </div>
  );
}
