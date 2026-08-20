import { CaseEventType, ClientApprovalKind, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { t } from "@/lib/i18n";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { isCaseVisible } from "@/lib/permissions/scope";

/**
 * Staff side of the client-facing approval flow (اعتمادات العميل — docs/03
 * PROPOSALS + CLIENT_APPR, docs/05 client portal). Staff raises a
 * memo/fee-proposal/settlement request against a case; the client
 * approves/rejects it from the portal (src/server/portal.ts). Mirrors the
 * internal review pipeline in src/server/approvals.ts, but this is the
 * client-visible track — a separate lifecycle, not a substage of it.
 */

async function loadVisibleCase(session: AppSession, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { id: caseId, officeId: session.officeId, deletedAt: null },
    include: { assignees: { select: { userId: true } } },
  });
  if (!c) throw new PermissionError("scope");
  const visible = await isCaseVisible(session, caseId, c.assignees.map((a) => a.userId));
  if (!visible) throw new PermissionError("scope");
  return c;
}

export async function listClientApprovals(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "view");
  await loadVisibleCase(session, caseId);
  return prisma.clientApprovalRequest.findMany({
    where: { officeId: session.officeId, caseId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

const createSchema = z.object({
  title: z.string().trim().min(1),
  kind: z.nativeEnum(ClientApprovalKind),
  amount: z.number().int().min(0).nullish(),
  note: z.string().trim().max(2000).nullish(),
});
export type CreateClientApprovalInput = z.infer<typeof createSchema>;

/**
 * Partner-tier gated (docs guardrail #1: nothing reaches the client without
 * passing a higher-trust checkpoint) — this creates a client-facing request
 * directly, with none of the internal 5-stage review that `sendApprovalToClient`
 * (src/server/approvals.ts) enforces on its own track. Regular case-edit
 * staff must route through that reviewed track instead.
 */
export async function createClientApprovalRequest(session: AppSession, caseId: string, raw: CreateClientApprovalInput) {
  await requireModule(session, PermModule.CASES, "delete");
  const input = createSchema.parse(raw);
  await loadVisibleCase(session, caseId);
  const created = await prisma.clientApprovalRequest.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      caseId,
      title: input.title,
      kind: input.kind,
      amount: input.kind === ClientApprovalKind.MEMO ? null : input.amount ?? null,
      note: input.note ?? null,
    },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.APPROVAL,
    description: t("event.clientApprovalCreated", { title: input.title }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "clientApproval.create", resource: "cases", targetId: created.id, detail: input.title });
  return created;
}
