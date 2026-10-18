import { type PipeTransform } from "@nestjs/common";
import { ErrorCode } from "@murafaa/contracts";
import type { z } from "zod";
import { ApiException } from "../http/api.exception.js";

/** Parses input with a contract schema; failures become a VALIDATION_FAILED envelope. */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new ApiException(
      ErrorCode.VALIDATION_FAILED,
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
}
