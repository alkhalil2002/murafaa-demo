import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { toApiError } from "../src/common/filters/all-exceptions.filter.js";
import { ApiException } from "../src/common/http/api.exception.js";

describe("toApiError", () => {
  it("keeps ApiException codes and details", () => {
    const { status, error } = toApiError(
      new ApiException("VALIDATION_FAILED", [{ path: "a", message: "m" }]),
    );
    expect(status).toBe(400);
    expect(error).toEqual({
      code: "VALIDATION_FAILED",
      messageKey: "errors.VALIDATION_FAILED",
      details: [{ path: "a", message: "m" }],
    });
  });

  it("maps Nest HTTP exceptions by status", () => {
    expect(toApiError(new NotFoundException()).error.code).toBe("NOT_FOUND");
    expect(toApiError(new ForbiddenException()).status).toBe(403);
  });

  it("hides unknown errors as INTERNAL 500", () => {
    const { status, error } = toApiError(new Error("db password is hunter2"));
    expect(status).toBe(500);
    expect(error).toEqual({ code: "INTERNAL", messageKey: "errors.INTERNAL" });
  });
});
