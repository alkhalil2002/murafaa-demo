/** An ILIKE "contains" pattern with the user's %, _ and \ taken literally. */
export function containsPattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
