import { createOfficeBody } from "@murafaa/contracts";
import { describe, expect, it } from "vitest";
import { ApiException } from "../src/common/http/api.exception.js";
import { ZodValidationPipe } from "../src/common/zod/zod-validation.pipe.js";

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe(createOfficeBody);

  it("returns the parsed (transformed) value", () => {
    expect(pipe.transform({ name: "  مكتب  " })).toEqual({ name: "مكتب" });
  });

  it("throws VALIDATION_FAILED with field paths", () => {
    try {
      pipe.transform({ name: "" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiException);
      const err = e as ApiException;
      expect(err.code).toBe("VALIDATION_FAILED");
      expect(err.getStatus()).toBe(400);
      expect(err.details?.[0]?.path).toBe("name");
    }
  });
});
