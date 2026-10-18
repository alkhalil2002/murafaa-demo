import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { type ApiError, ErrorCode } from "@murafaa/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiException, statusOf } from "../http/api.exception.js";

function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 401:
      return ErrorCode.UNAUTHENTICATED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 429:
      return ErrorCode.RATE_LIMITED;
    default:
      return status >= 500 ? ErrorCode.INTERNAL : ErrorCode.VALIDATION_FAILED;
  }
}

/** Map anything thrown to an HTTP status and an envelope error. Never leaks internals. */
export function toApiError(exception: unknown): { status: number; error: ApiError } {
  if (exception instanceof ApiException) {
    return {
      status: statusOf(exception.code),
      error: {
        code: exception.code,
        messageKey: exception.messageKey ?? `errors.${exception.code}`,
        details: exception.details,
      },
    };
  }
  const status =
    exception instanceof HttpException
      ? exception.getStatus()
      : ((exception as { statusCode?: number } | null)?.statusCode ?? 500);
  // Body-parsing refusals keep their HTTP status and get an upload message.
  if (status === 413 || status === 415) {
    return {
      status,
      error: {
        code: ErrorCode.VALIDATION_FAILED,
        messageKey: status === 413 ? "errors.UPLOAD_TOO_LARGE" : "errors.UPLOAD_TYPE",
      },
    };
  }
  const code = codeForStatus(status);
  return {
    status: statusOf(code) === status ? status : statusOf(code),
    error: { code, messageKey: `errors.${code}` },
  };
}

/** Renders every error as `{ data: null, error }` (CLAUDE.md conventions). */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const { status, error } = toApiError(exception);
    if (status >= 500) this.logger.error(exception);
    void reply
      .status(status)
      .send({ data: null, error: { ...error, requestId: String(request.id) } });
  }
}
