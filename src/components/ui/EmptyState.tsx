import * as React from 'react';
import { cn } from './cn';
import { GoldRule } from './marks';

export interface EmptyStateProps {
  /** Decorative mark or icon shown above the title. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Primary call to action, usually a `<Button>`. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * The "nothing here yet" surface.
 *
 * Takes text as props rather than message keys: the caller owns the copy and
 * passes it through `t()`, keeping Arabic strings out of the component (see
 * the i18n rule in CLAUDE.md).
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg',
        'border border-dashed border-line bg-parch-100 px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? <div className="text-parch-500">{icon}</div> : <GoldRule size="sm" />}
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="max-w-prose text-sm leading-normal text-ink-soft">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
