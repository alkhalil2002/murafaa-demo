import { ApprovalStage, CaseEventType, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { t } from "@/lib/i18n";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, canAction, requireModule } from "@/lib/permissions/guard";
import { isCaseVisible } from "@/lib/permissions/scope";
import { decideReportApproval } from "./hearings";

/**
 * Internal case-review pipeline (الاعتمادات, docs/05). A document/deliverable
 * moves through a fixed 5-stage review before it's "معتمد" (approved):
 * مسودة ← محامٍ أول ← مستشار ← تدقيق لغوي ← اعتماد الشريك ← معتمد. Gated by
 * the CASES module (this is internal review, not the client-facing report
 * approval gate — that's Phase 8's client portal).
 */

const STAGE_ORDER: ApprovalStage[] = [
  ApprovalStage.DRAFT,
  ApprovalStage.SENIOR_LAWYER,
  ApprovalStage.COUNSEL,
  ApprovalStage.PROOFREADING,
  ApprovalStage.PARTNER,
  ApprovalStage.APPROVED,
];

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

export async function listApprovals(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "view");
  await loadVisibleCase(session, caseId);
  const approvals = await prisma.caseApproval.findMany({
    where: { officeId: session.officeId, caseId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const events = await prisma.caseEvent.findMany({
    where: { officeId: session.officeId, caseId, approvalId: { in: approvals.map((a) => a.id) } },
    orderBy: { occurredAt: "desc" },
  });
  const eventsByApproval = new Map<string, typeof events>();
  for (const e of events) {
    if (!e.approvalId) continue;
    const list = eventsByApproval.get(e.approvalId) ?? [];
    list.push(e);
    eventsByApproval.set(e.approvalId, list);
  }
  return approvals.map((a) => ({ ...a, log: eventsByApproval.get(a.id) ?? [] }));
}

/** Pending (not-yet-approved) items across every case the caller may see —
 * feeds the "اعتمادات تنتظرك" panel on the Today landing page. */
export async function listPendingApprovals(session: AppSession) {
  await requireModule(session, PermModule.CASES, "view");
  return prisma.caseApproval.findMany({
    where: {
      officeId: session.officeId,
      deletedAt: null,
      stage: { not: ApprovalStage.APPROVED },
      case: { deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    include: { case: { select: { id: true, title: true } } },
  });
}

const createSchema = z.object({ title: z.string().trim().min(1), hearingId: z.string().uuid().nullish() });

export async function createApproval(session: AppSession, caseId: string, raw: { title: string; hearingId?: string | null }) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = createSchema.parse(raw);
  await loadVisibleCase(session, caseId);
  if (input.hearingId) {
    const h = await prisma.hearing.findFirst({
      where: { id: input.hearingId, caseId, officeId: session.officeId, deletedAt: null },
    });
    if (!h) throw new PermissionError("scope");
  }
  const created = await prisma.caseApproval.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      caseId,
      title: input.title,
      stage: ApprovalStage.DRAFT,
      hearingId: input.hearingId ?? null,
    },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.APPROVAL,
    description: t("event.approvalCreated", { title: input.title }),
    actorUserId: session.userId,
    approvalId: created.id,
  });
  await logAudit({ session, action: "approval.create", resource: "cases", targetId: created.id, detail: input.title });
  return created;
}

async function loadOwnApproval(session: AppSession, id: string) {
  const a = await prisma.caseApproval.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!a) throw new PermissionError("scope");
  await loadVisibleCase(session, a.caseId); // enforces row-scope on the parent case
  return a;
}

/** Advance one stage (bounded — no-op past APPROVED). Reaching APPROVED with a
 * linked hearing auto-decides that hearing's pending client-report approval,
 * if the acting session actually holds the partner-tier gate for it — this
 * is a convenience trigger, not a privilege escalation (docs/04: no god mode). */
export async function advanceApproval(session: AppSession, id: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const a = await loadOwnApproval(session, id);
  const idx = STAGE_ORDER.indexOf(a.stage);
  if (idx >= STAGE_ORDER.length - 1) return a;
  const nextStage = STAGE_ORDER[idx + 1]!;
  const updated = await prisma.caseApproval.update({ where: { id }, data: { stage: nextStage } });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId: a.caseId,
    type: CaseEventType.APPROVAL,
    description: t("event.approvalAdvanced", { title: a.title, stage: t(`approvalStage.${nextStage}`) }),
    actorUserId: session.userId,
    approvalId: id,
  });
  await logAudit({ session, action: "approval.advance", resource: "cases", targetId: id, detail: nextStage });

  if (nextStage === ApprovalStage.APPROVED && a.hearingId && (await canAction(session, PermModule.CASES, "delete"))) {
    try {
      await decideReportApproval(session, a.caseId, a.hearingId, true);
    } catch {
      // Hearing report may already be decided, or approval wasn't requested — not fatal to the approval itself.
    }
  }
  return updated;
}

export async function deleteApproval(session: AppSession, id: string) {
  await requireModule(session, PermModule.CASES, "delete");
  const a = await loadOwnApproval(session, id);
  await prisma.caseApproval.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ session, action: "approval.delete", resource: "cases", targetId: a.caseId, detail: id });
}

/** Send back to DRAFT (docs' reviewer "reject" — no partial rejection states). */
export async function rejectApproval(session: AppSession, id: string, note?: string | null) {
  await requireModule(session, PermModule.CASES, "edit");
  const a = await loadOwnApproval(session, id);
  const updated = await prisma.caseApproval.update({
    where: { id },
    data: { stage: ApprovalStage.DRAFT },
  });
  const trimmedNote = note?.trim() || null;
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId: a.caseId,
    type: CaseEventType.APPROVAL,
    description: trimmedNote
      ? t("event.approvalRejectedWithNote", { title: a.title, note: trimmedNote })
      : t("event.approvalRejected", { title: a.title }),
    actorUserId: session.userId,
    approvalId: id,
  });
  await logAudit({ session, action: "approval.reject", resource: "cases", targetId: id, detail: trimmedNote ?? undefined });
  return updated;
}
