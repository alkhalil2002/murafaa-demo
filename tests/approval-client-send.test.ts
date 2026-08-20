import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApprovalStage, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { sendApprovalToClient } from "@/server/approvals";
import { ALL_MODULES, ALL_ROLES, SEED_CASE_SCOPE, SEED_FIELD_DENY, seedLevel } from "@/lib/permissions/matrix";

/**
 * sendApprovalToClient guard conditions (internal review → client-facing
 * approval bridge). Mirrors tests/portal.test.ts: a minimal office/case
 * fixture built directly via prisma, torn down afterward.
 */

/** Seeds the same default permission matrix as self-serve registration
 * (src/server/registration.ts) — a bare office row has NO grants (no god
 * mode, docs/04 §6), so requireModule denies everything without this. */
async function makeOffice() {
  const office = await prisma.office.create({ data: { name: `Test Office ${randomUUID()}` } });
  await prisma.permission.createMany({
    data: ALL_ROLES.flatMap((role) =>
      ALL_MODULES.map((module) => ({ officeId: office.id, role, module, level: seedLevel(role, module) })),
    ),
  });
  await prisma.fieldPermission.createMany({
    data: SEED_FIELD_DENY.map((f) => ({ officeId: office.id, ...f })),
  });
  await prisma.roleCaseScope.createMany({
    data: ALL_ROLES.map((role) => ({ officeId: office.id, role, scope: SEED_CASE_SCOPE[role] })),
  });
  return office;
}

async function makeCase(officeId: string) {
  const client = await prisma.client.create({ data: { officeId, name: "Test Client", phone: `05${Date.now()}` } });
  return prisma.case.create({ data: { officeId, clientId: client.id, number: `${Date.now()}`, title: "Test Case" } });
}

function sessionFor(officeId: string): AppSession {
  return { userId: randomUUID(), officeId, name: "Test Partner", phone: "0500000001", role: Role.PARTNER };
}

describe("sendApprovalToClient — guard conditions", () => {
  const cleanupOfficeIds: string[] = [];

  afterAll(async () => {
    for (const officeId of cleanupOfficeIds) {
      await prisma.auditLog.deleteMany({ where: { officeId } });
      await prisma.caseEvent.deleteMany({ where: { officeId } });
      await prisma.document.deleteMany({ where: { officeId } });
      await prisma.clientApprovalRequest.deleteMany({ where: { officeId } });
      await prisma.caseApproval.deleteMany({ where: { officeId } });
      await prisma.case.deleteMany({ where: { officeId } });
      await prisma.client.deleteMany({ where: { officeId } });
      await prisma.permission.deleteMany({ where: { officeId } });
      await prisma.fieldPermission.deleteMany({ where: { officeId } });
      await prisma.roleCaseScope.deleteMany({ where: { officeId } });
      await prisma.office.deleteMany({ where: { id: officeId } });
    }
  });

  async function setup() {
    const office = await makeOffice();
    cleanupOfficeIds.push(office.id);
    const c = await makeCase(office.id);
    const session = sessionFor(office.id);
    return { office, case: c, session };
  }

  it("rejects sending an approval that has not reached APPROVED", async () => {
    const { case: c, session } = await setup();
    const approval = await prisma.caseApproval.create({
      data: { officeId: session.officeId, caseId: c.id, title: "مذكرة دفاع", stage: ApprovalStage.DRAFT, body: "نص المذكرة" },
    });
    await expect(sendApprovalToClient(session, approval.id)).rejects.toThrow("APPROVAL_NOT_YET_APPROVED");
  });

  it("rejects sending an approved item with no body", async () => {
    const { case: c, session } = await setup();
    const approval = await prisma.caseApproval.create({
      data: { officeId: session.officeId, caseId: c.id, title: "مذكرة دفاع", stage: ApprovalStage.APPROVED, body: null },
    });
    await expect(sendApprovalToClient(session, approval.id)).rejects.toThrow("APPROVAL_HAS_NO_BODY");
  });

  it("rejects sending an approval that was already sent to the client", async () => {
    const { case: c, session } = await setup();
    const clientRequest = await prisma.clientApprovalRequest.create({
      data: { officeId: session.officeId, caseId: c.id, title: "مذكرة دفاع", kind: "MEMO" },
    });
    const approval = await prisma.caseApproval.create({
      data: {
        officeId: session.officeId,
        caseId: c.id,
        title: "مذكرة دفاع",
        stage: ApprovalStage.APPROVED,
        body: "نص المذكرة",
        clientApprovalRequestId: clientRequest.id,
      },
    });
    await expect(sendApprovalToClient(session, approval.id)).rejects.toThrow("APPROVAL_ALREADY_SENT");
  });
});
