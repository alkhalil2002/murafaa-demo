import type { MessageKey } from "@murafaa/i18n";

type ErrorBody = { error?: { messageKey?: string; details?: Array<{ message: string }> } };

/** The i18n key to show for an API error envelope: field message first, then the error's own message. */
export function apiErrorKey(body: unknown): MessageKey {
  const error = (body as ErrorBody | undefined)?.error;
  return (error?.details?.[0]?.message ?? error?.messageKey ?? "auth.error.generic") as MessageKey;
}
