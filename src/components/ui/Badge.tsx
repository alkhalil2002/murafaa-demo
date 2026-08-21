import * as React from 'react';
import { cn } from './cn';
import { variants, type VariantProps } from './variants';

/**
 * Status pill.
 *
 * Tones are named after domain state, not colour, so a palette swap or a
 * changed enum never leaves a call site saying `variant="green"` about a
 * suspended case. Case lifecycle mirrors `CaseStatus`, outcomes mirror
 * `CaseOutcome`, and the urgency band mirrors the deadline tones already used
 * on the dashboard.
 *
 * Backgrounds are an alpha of the state colour so a palette swap carries them.
 * The foreground hexes are NOT alphas of the same colour — they are darkened
 * to clear 4.5:1 on the tinted background, so they stay literal.
 */
const badgeVariants = variants(
  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-parch-200 text-ink-soft',
        // case lifecycle
        active: 'bg-case-active/10 text-[#215c43]',
        suspended: 'bg-case-suspended/10 text-[#8a4616]',
        closed: 'bg-case-closed/15 text-ink-soft',
        // outcome
        won: 'bg-outcome-won/10 text-[#215c43]',
        partial: 'bg-outcome-partial/15 text-[#7d651a]',
        settled: 'bg-outcome-settled/10 text-[#2c50a0]',
        lost: 'bg-outcome-lost/10 text-[#8c1c24]',
        // urgency
        critical: 'bg-urgency-critical/10 text-[#8c1c24]',
        serious: 'bg-urgency-serious/15 text-[#8f4d12]',
        warning: 'bg-urgency-warning/15 text-[#7d651a]',
        good: 'bg-urgency-good/10 text-[#215c43]',
        // chrome
        gold: 'bg-gold/20 text-[#7a5c24]',
        bench: 'bg-bench/10 text-bench',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type BadgeTone =
  | 'default'
  | 'active'
  | 'suspended'
  | 'closed'
  | 'won'
  | 'partial'
  | 'settled'
  | 'lost'
  | 'critical'
  | 'serious'
  | 'warning'
  | 'good'
  | 'gold'
  | 'bench';

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<{ variant: Record<BadgeTone, string> }> {
  /** Leading status dot. On by default; turn off for dense table cells. */
  withDot?: boolean;
}

export function Badge({ className, variant, withDot = true, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {withDot ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}

export { badgeVariants };
export type { BadgeTone };
