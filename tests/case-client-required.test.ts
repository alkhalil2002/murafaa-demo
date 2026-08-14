import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * docs/06 §case-client — a case must be linked to a client.
 *
 * Mirrors the create/update schemas in src/server/cases.ts. The point of
 * testing the shapes rather than the service is that this rule lives entirely
 * in the schema: if `.partial()` or a `.nullish()` creeps back, the rule
 * silently stops applying and nothing else would catch it.
 */
const createSchema = z.object({
  number: z.string().min(1),
  title: z.string().min(1),
  clientId: z.string().uuid({ message: "CLIENT_REQUIRED" }),
});
const updateSchema = createSchema.partial().extend({
  clientId: z.string().uuid().optional(),
});

const UUID = "11111111-2222-4333-8444-555555555555";

describe("creating a case", () => {
  it("succeeds with a client", () => {
    expect(createSchema.safeParse({ number: "1", title: "t", clientId: UUID }).success).toBe(true);
  });

  it("refuses a missing client", () => {
    expect(createSchema.safeParse({ number: "1", title: "t" }).success).toBe(false);
  });

  it("refuses an explicit null — the old nullish() shape must not come back", () => {
    expect(createSchema.safeParse({ number: "1", title: "t", clientId: null }).success).toBe(false);
  });

  it("refuses an empty string, which is what an unselected dropdown submits", () => {
    expect(createSchema.safeParse({ number: "1", title: "t", clientId: "" }).success).toBe(false);
  });

  it("refuses a non-uuid", () => {
    expect(createSchema.safeParse({ number: "1", title: "t", clientId: "acme" }).success).toBe(false);
  });
});

describe("updating a case", () => {
  it("may omit the client entirely — leave it as it is", () => {
    expect(updateSchema.safeParse({ title: "new" }).success).toBe(true);
  });

  it("may move the case to a different client", () => {
    expect(updateSchema.safeParse({ clientId: UUID }).success).toBe(true);
  });

  it("must NOT be able to unlink a case once linked", () => {
    // Without this the rule would hold only for the first moments of a case's
    // life: create it with a client, then clear the field on the edit form.
    expect(updateSchema.safeParse({ clientId: null }).success).toBe(false);
    expect(updateSchema.safeParse({ clientId: "" }).success).toBe(false);
  });
});
