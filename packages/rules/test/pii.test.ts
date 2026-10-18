import { describe, expect, it } from "vitest";
import { maskIban } from "../src/pii.js";

describe("maskIban", () => {
  it("keeps only the country code and the last 4 characters", () => {
    expect(maskIban(" SA0380000000608010167519 ")).toBe("SA••••7519");
  });

  it("leaves very short values unchanged", () => {
    expect(maskIban("1234")).toBe("1234");
  });
});
