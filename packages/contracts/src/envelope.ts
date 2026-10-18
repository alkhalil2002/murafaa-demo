import { z } from "zod";

/**
 * Every API response is `{ data, error }` (CLAUDE.md conventions): exactly one
 * of the two is non-null. Error messages are i18n keys, never display text.
 */

export const ErrorCode = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const apiError = z
  .object({
    code: z.enum(ErrorCode),
    /** i18n message key for the client to render, e.g. "errors.FORBIDDEN". */
    messageKey: z.string(),
    /** Field-level issues for VALIDATION_FAILED: path → i18n-able message. */
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    requestId: z.string().optional(),
  })
  .meta({ id: "ApiError" });
export type ApiError = z.infer<typeof apiError>;

export function successEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ data, error: z.null() });
}

export const errorEnvelope = z
  .object({ data: z.null(), error: apiError })
  .meta({ id: "ErrorEnvelope" });
export type ErrorEnvelope = z.infer<typeof errorEnvelope>;

export type Envelope<T> = { data: T; error: null } | ErrorEnvelope;

export function ok<T>(data: T): { data: T; error: null } {
  return { data, error: null };
}
