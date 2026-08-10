import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { InvoiceBaseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { PortalSession } from "@/lib/auth/portal-session";
import {
  decidePortalApproval,
  listPortalInvoices,
  uploadPortalDocument,
} from "@/server/portal";

/**
 * Portal row-scope + lifecycle tests (client approvals + document upload +
 * invoices). No fixture helper exists yet for portal tests, so this sets up
 * a minimal office/client/case tree directly via prisma, mirroring the shape
 * other server modules (e.g. src/server/portal.ts itself) expect, and tears
 * it down afterward.
 */

async function makeOffice() {
  return prisma.office.create({ data: { name: `Test Office ${randomUUID()}` } });
}

async function makeClient(officeId: string, phone: string) {
  return prisma.client.create({ data: { officeId, name: "Test Client", phone } });
}

async function makeCase(officeId: string, clientId: string) {
  return prisma.case.create({ data: { officeId, clientId, number: `${Date.now()}`, title: "Test Case" } });
}

function sessionFor(clientId: string, officeId: string): PortalSession {
  return { clientId, officeId, name: "Test Client", phone: "0500000000" };
}

describe("portal — client approvals, uploads, invoices (row-scope)", () => {
  const cleanupOfficeIds: string[] = [];

  afterAll(async () => {
    for (const officeId of cleanupOfficeIds) {
      await prisma.auditLog.deleteMany({ where: { officeId } });
      await prisma.clientApprovalRequest.deleteMany({ where: { officeId } });
      await prisma.document.deleteMany({ where: { officeId } });
      await prisma.payment.deleteMany({ where: { invoice: { officeId } } });
      await prisma.invoice.deleteMany({ where: { officeId } });
      await prisma.case.deleteMany({ where: { officeId } });
      await prisma.client.deleteMany({ where: { officeId } });
      await prisma.office.deleteMany({ where: { id: officeId } });
    }
  });

  async function setup() {
    const office = await makeOffice();
    cleanupOfficeIds.push(office.id);
    const clientA = await makeClient(office.id, "0500000001");
    const clientB = await makeClient(office.id, "0500000002");
    const caseA = await makeCase(office.id, clientA.id);
    return { office, clientA, clientB, caseA };
  }

  it("a client cannot decide an approval belonging to another client's case", async () => {
    const { office, clientB, caseA } = await setup();
    const approval = await prisma.clientApprovalRequest.create({
      data: { officeId: office.id, caseId: caseA.id, title: "مذكرة دفاع", kind: "MEMO" },
    });
    const otherSession = sessionFor(clientB.id, office.id);
    await expect(decidePortalApproval(otherSession, caseA.id, approval.id, true)).rejects.toThrow();
  });

  it("decidePortalApproval rejects deciding an already-decided request", async () => {
    const { office, clientA, caseA } = await setup();
    const approval = await prisma.clientApprovalRequest.create({
      data: { officeId: office.id, caseId: caseA.id, title: "تسوية", kind: "SETTLEMENT", amount: 100000 },
    });
    const session = sessionFor(clientA.id, office.id);
    const decided = await decidePortalApproval(session, caseA.id, approval.id, true);
    expect(decided.status).toBe("APPROVED");
    await expect(decidePortalApproval(session, caseA.id, approval.id, false)).rejects.toThrow(
      "APPROVAL_ALREADY_DECIDED",
    );
  });

  it("uploadPortalDocument rejects a file for a case outside the client's scope", async () => {
    const { office, clientB, caseA } = await setup();
    const otherSession = sessionFor(clientB.id, office.id);
    await expect(
      uploadPortalDocument(otherSession, caseA.id, {
        fileName: "test.pdf",
        mimeType: "application/pdf",
        bytes: Buffer.from("hello"),
      }),
    ).rejects.toThrow();
  });

  it("uploadPortalDocument succeeds for the owning client and the doc becomes client-visible", async () => {
    const { office, clientA, caseA } = await setup();
    const session = sessionFor(clientA.id, office.id);
    const doc = await uploadPortalDocument(session, caseA.id, {
      fileName: "test.pdf",
      mimeType: "application/pdf",
      bytes: Buffer.from("hello"),
    });
    expect(doc.clientVisible).toBe(true);
    expect(doc.source).toBe("CLIENT");
  });

  it("a client only sees their own invoices, never another client's", async () => {
    const { office, clientA, clientB, caseA } = await setup();
    await prisma.invoice.create({
      data: {
        officeId: office.id,
        clientId: clientA.id,
        caseId: caseA.id,
        number: `INV-${randomUUID()}`,
        issueDate: new Date(),
        netAmount: 10000,
        vatAmount: 1500,
        totalAmount: 11500,
        baseStatus: InvoiceBaseStatus.DUE,
      },
    });
    const sessionA = sessionFor(clientA.id, office.id);
    const sessionB = sessionFor(clientB.id, office.id);
    const invoicesA = await listPortalInvoices(sessionA);
    const invoicesB = await listPortalInvoices(sessionB);
    expect(invoicesA.length).toBe(1);
    expect(invoicesB.length).toBe(0);
  });
});
