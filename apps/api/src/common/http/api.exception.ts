import { HttpException } from "@nestjs/common";
import { ErrorCode, type ApiError } from "@murafaa/contracts";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/** An error that already knows its envelope code. The exception filter renders it as-is. */
export class ApiException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    readonly details?: ApiError["details"],
  ) {
    super(code, STATUS[code]);
  }
}

export function statusOf(code: ErrorCode): number {
  return STATUS[code];
}
