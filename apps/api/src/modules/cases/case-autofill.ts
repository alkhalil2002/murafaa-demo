import { clients, type Tx } from "@murafaa/database";
import type { CaseAutofill } from "@murafaa/documents";
import { eq } from "drizzle-orm";
import type { CaseRow } from "./case-access.service.js";

/** The case values a document template may prefill (legacy loadCaseForDocs). */
export async function caseAutofill(tx: Tx, c: CaseRow): Promise<CaseAutofill> {
  const [client] = c.clientId
    ? await tx.select({ name: clients.name }).from(clients).where(eq(clients.id, c.clientId))
    : [];
  return {
    clientName: client?.name ?? null,
    opposingParty: c.opposingParty,
    caseType: c.najizCaseType,
    city: c.city,
  };
}
