import { NextResponse } from "next/server";
import type { MessageKey } from "@/lib/i18n";

/**
 * Uniform API envelope: every response is `{ data, error }` (CLAUDE.md).
 * Exactly one of the two is non-null.
 */
export type ApiError = {
  /** Stable machine code, e.g. "PERM_DENIED", "VALIDATION". */
  code: string;
  /** i18n key the client can translate; falls back to `code`. */
  messageKey?: MessageKey;
  /** Field-level validation issues, if any. */
  fields?: Record<string, string[]>;
};

export type ApiResponse<T> = { data: T; error: null } | { data: null; error: ApiError };

export function ok<T>(data: T, init?: number | ResponseInit): NextResponse {
  return NextResponse.json<ApiResponse<T>>(
    { data, error: null },
    typeof init === "number" ? { status: init } : init,
  );
}

export function fail(error: ApiError, status = 400): NextResponse {
  return NextResponse.json<ApiResponse<never>>({ data: null, error }, { status });
}

/** Common failures with the right HTTP status. */
export const apiErrors = {
  unauthorized: () =>
    fail({ code: "UNAUTHORIZED", messageKey: "perm.denied.generic" }, 401),
  forbiddenModule: () =>
    fail({ code: "PERM_DENIED_MODULE", messageKey: "perm.denied.module" }, 403),
  forbiddenField: () =>
    fail({ code: "PERM_DENIED_FIELD", messageKey: "perm.denied.field" }, 403),
  forbiddenScope: () =>
    fail({ code: "PERM_DENIED_SCOPE", messageKey: "perm.denied.scope" }, 403),
  validation: (fields: Record<string, string[]>) =>
    fail({ code: "VALIDATION", fields }, 422),
  notFound: () => fail({ code: "NOT_FOUND" }, 404),
} as const;
