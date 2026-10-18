/** Whether an error (possibly wrapped by Drizzle) is a Postgres unique violation, optionally on one constraint. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const cause = (error as { cause?: { code?: string; constraint_name?: string } } | undefined)
    ?.cause;
  const pg = cause ?? (error as { code?: string; constraint_name?: string } | undefined);
  return pg?.code === "23505" && (!constraint || pg.constraint_name === constraint);
}
