/**
 * Class-name joiner.
 *
 * Alkhalil's equivalent is `twMerge(clsx(...))`. Murafaa deliberately runs a
 * lean dependency set (CLAUDE.md: no new tech without approval), so this is a
 * dependency-free equivalent of the `clsx` half.
 *
 * The `twMerge` half is intentionally absent: it costs ~6kB gzipped and only
 * matters when a caller has to *override* a component's own utility. The
 * components in this folder take `className` last in the join order, which
 * covers the common case — later classes win in the cascade when specificity
 * ties. If you hit a genuine conflict (`p-6` vs `p-2`), pass the variant prop
 * instead of fighting it with `className`.
 *
 * To adopt real tailwind-merge later, install it and change only this file.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, unknown>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  const walk = (value: ClassValue): void => {
    if (!value) return;
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (typeof value === 'object') {
      for (const [key, enabled] of Object.entries(value)) {
        if (enabled) out.push(key);
      }
    }
  };

  for (const input of inputs) walk(input);
  return out.join(' ');
}
