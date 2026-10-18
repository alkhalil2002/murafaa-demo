import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";
import { llmFor } from "../src/modules/ai/llm.js";
import { searchTerms } from "../src/modules/ai/ai.service.js";

const base = {
  DATABASE_URL: "postgres://u@localhost/db",
  AUTH_SECRET: "x".repeat(40),
  ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
};

describe("AI provider", () => {
  it("is not connected by default and refuses to generate (nothing is faked)", async () => {
    const llm = llmFor(loadEnv(base));
    expect(llm.connected).toBe(false);
    await expect(llm.generate({ system: "s", prompt: "p" })).rejects.toMatchObject({
      code: "UNAVAILABLE",
      messageKey: "errors.AI_UNAVAILABLE",
    });
  });

  it("needs a project and a model for Vertex", () => {
    expect(() => loadEnv({ ...base, AI_PROVIDER: "vertex" })).toThrow(/VERTEX_PROJECT_ID/);
    const llm = llmFor(
      loadEnv({ ...base, AI_PROVIDER: "vertex", VERTEX_PROJECT_ID: "p", AI_MODEL: "m" }),
    );
    expect(llm).toMatchObject({ name: "vertex", connected: true, region: "me-central2" });
  });

  it("turns free text into safe, normalized search terms", () => {
    expect(searchTerms("هل يُستحقّ التعويض؟ المادة (77) | DROP")).toEqual([
      "هل",
      "يستحق",
      "التعويض",
      "الماده",
      "77",
      "drop",
    ]);
    expect(searchTerms("؟!")).toEqual([]);
  });
});
