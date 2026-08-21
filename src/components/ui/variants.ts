import { cn, type ClassValue } from './cn';

/**
 * Minimal `class-variance-authority` stand-in.
 *
 * Alkhalil's UI package uses `cva`; Murafaa keeps a lean dependency set, so
 * this reimplements the slice of the API the components here need — variants,
 * defaultVariants, and compoundVariants — in a few dozen lines with the same
 * call signature. Swapping to the real package later means changing the import
 * in this file only.
 *
 *   const button = variants('base-classes', {
 *     variants: { tone: { primary: '…', ghost: '…' } },
 *     defaultVariants: { tone: 'primary' },
 *   })
 *   button({ tone: 'ghost' })
 */

type VariantShape = Record<string, Record<string, ClassValue>>;

type VariantProps<V extends VariantShape> = {
  [K in keyof V]?: keyof V[K] | null | undefined;
};

interface Options<V extends VariantShape> {
  variants?: V;
  defaultVariants?: VariantProps<V>;
  /** Classes applied only when every listed variant matches. */
  compoundVariants?: Array<VariantProps<V> & { class: ClassValue }>;
}

export type { VariantProps };

export function variants<V extends VariantShape>(base: ClassValue, options: Options<V> = {}) {
  const { variants: map, defaultVariants, compoundVariants } = options;

  return (props?: VariantProps<V> & { className?: ClassValue }): string => {
    const { className, ...selected } = props ?? ({} as VariantProps<V> & { className?: ClassValue });
    const resolved = { ...defaultVariants, ...stripUndefined(selected) } as VariantProps<V>;

    const applied: ClassValue[] = [base];

    if (map) {
      for (const [key, options] of Object.entries(map)) {
        const choice = resolved[key as keyof V];
        if (choice == null) continue;
        applied.push(options[choice as string]);
      }
    }

    if (compoundVariants) {
      for (const rule of compoundVariants) {
        const { class: extra, ...conditions } = rule;
        const matches = Object.entries(conditions).every(
          ([key, want]) => resolved[key as keyof V] === want,
        );
        if (matches) applied.push(extra);
      }
    }

    applied.push(className);
    return cn(...applied);
  };
}

/** An explicit `undefined` prop must not clobber a default variant. */
function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
