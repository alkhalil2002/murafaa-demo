import { describe, expect, it } from "vitest";
import {
  ARENA_ROLES,
  ARENA_SYSTEM,
  ASSISTANT_SYSTEM,
  CITE_RULE,
} from "../src/modules/ai/prompts.js";

describe("AI system prompts", () => {
  it("carry the closed-KB citation rule into every role", () => {
    expect(ASSISTANT_SYSTEM).toContain(CITE_RULE);
    for (const role of ARENA_ROLES) expect(ARENA_SYSTEM[role], role).toContain(CITE_RULE);
  });
});
