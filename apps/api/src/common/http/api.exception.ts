import { HttpException } from "@nestjs/common";
import { ErrorCode, type ApiError } from "@murafaa/contracts";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  OTP_EXPIRED: 400,
  OTP_INVALID: 400,
  OTP_TOO_MANY_ATTEMPTS: 429,
  TOTP_REQUIRED: 401,
  TOTP_INVALID: 401,
  IP_NOT_ALLOWED: 403,
  INTERNAL: 500,
  UNAVAILABLE: 503,
};

/** An error that already knows its envelope code. The exception filter renders it as-is. */
export class ApiException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    readonly details?: ApiError["details"],
    /** A more specific i18n message than errors.<code>, e.g. errors.LAST_PARTNER for a CONFLICT. */
    readonly messageKey?: string,
  ) {
    super(code, STATUS[code]);
  }
}

export function statusOf(code: ErrorCode): number {
  return STATUS[code];
}
