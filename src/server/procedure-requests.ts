import { CaseEventType, DocParty, PermModule, ProcedureRequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { t } from "@/lib/i18n";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { isCaseVisible } from "@/lib/permissions/scope";

/**
 * Procedural requests/milestones (prototype "تفاصيل الطلبات والمعالم") — motions
 * filed within a procedural stage (expert appointment, objection, cassation
 * petition, etc). Grouped by stageIndex on the case detail page. Gated by the
 * القضايا module + case row-scope, same as hearings.
 */

/// Closed vocabulary for request `type` (prototype PROC_REQ_TYPES) — free-text
/// descriptor, not an enforced enum, mirrors Document.docType's convention.
export const PROC_REQUEST_TYPES = [
  "طلب ندب خبير",
  "طلب إدخال طرف (ضامن/خصم)",
  "طلب وقف سير الدعوى",
  "التماس إعادة النظر",
  "طلب تأجيل الجلسة",
  "دفع بعدم الاختصاص",
  "طلب ضمّ قضية",
  "طلب سماع شهود",
  "طلب تمكين من مستندات",
  "اعتراض / استئناف",
  "طلب آخر",
] as const;

async function loadVisibleCase(session: AppSession, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { id: caseId, officeId: session.officeId, deletedAt: null },
    include: { assignees: { select: { userId: true } } },
  });
  if (!c) throw new PermissionError("scope");
  if (!(await isCaseVisible(session, caseId, c.assignees.map((a) => a.userId))))
    throw new PermissionError("scope");
  return c;
}

async function loadOwnRequest(session: AppSession, caseId: string, requestId: string) {
  await loadVisibleCase(session, caseId);
  const r = await prisma.procedureRequest.findFirst({
    where: { id: requestId, caseId, officeId: session.officeId, deletedAt: null },
  });
  if (!r) throw new PermissionError("scope");
  return r;
}

const createSchema = z.object({
  stageIndex: z.number().int().min(0).max(4),
  party: z.nativeEnum(DocParty),
  type: z.enum(PROC_REQUEST_TYPES).nullish(),
  text: z.string().trim().min(1),
});

export async function addProcedureRequest(session: AppSession, caseId: string, raw: z.infer<typeof createSchema>) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = createSchema.parse(raw);
  await loadVisibleCase(session, caseId);
  const created = await prisma.procedureRequest.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      caseId,
      stageIndex: input.stageIndex,
      party: input.party,
      type: input.type ?? null,
      text: input.text,
    },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.REQUEST,
    description: t("event.procedureRequestAdded", { text: input.type ?? input.text }),
    actorUserId: session.userId,
    procedureRequestId: created.id,
  });
  await logAudit({ session, action: "procedureRequest.add", resource: "cases", targetId: caseId, detail: created.id });
  return created;
}

/** Cycle مُقدّم → قيد النظر → مقبول → مرفوض → مُقدّم (prototype PROC_REQ_STATUS). */
const STATUS_CYCLE: ProcedureRequestStatus[] = [
  ProcedureRequestStatus.SUBMITTED,
  ProcedureRequestStatus.PENDING,
  ProcedureRequestStatus.ACCEPTED,
  ProcedureRequestStatus.REJECTED,
];
export async function cycleProcedureRequestStatus(session: AppSession, caseId: string, requestId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const r = await loadOwnRequest(session, caseId, requestId);
  const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(r.status) + 1) % STATUS_CYCLE.length] ?? ProcedureRequestStatus.SUBMITTED;
  const updated = await prisma.procedureRequest.update({ where: { id: requestId }, data: { status: next } });
  const STATUS_LABEL_KEY = {
    SUBMITTED: "procedureRequestStatus.SUBMITTED",
    PENDING: "procedureRequestStatus.PENDING",
    ACCEPTED: "procedureRequestStatus.ACCEPTED",
    REJECTED: "procedureRequestStatus.REJECTED",
  } as const;
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.REQUEST,
    description: t("event.procedureRequestStatusChanged", { type: r.type ?? r.text, status: t(STATUS_LABEL_KEY[next]) }),
    actorUserId: session.userId,
    procedureRequestId: requestId,
  });
  await logAudit({
    session,
    action: "procedureRequest.cycleStatus",
    resource: "cases",
    targetId: caseId,
    detail: requestId,
  });
  return updated;
}

export async function deleteProcedureRequest(session: AppSession, caseId: string, requestId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const r = await loadOwnRequest(session, caseId, requestId);
  await prisma.procedureRequest.update({ where: { id: requestId }, data: { deletedAt: new Date() } });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.REQUEST,
    description: t("event.procedureRequestDeleted", { type: r.type ?? r.text }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "procedureRequest.delete", resource: "cases", targetId: caseId, detail: requestId });
}

/** Requests grouped by stage, each with its attached request/result docs and its own activity log (for the case detail card). */
export async function listProcedureRequests(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "view");
  await loadVisibleCase(session, caseId);
  const requests = await prisma.procedureRequest.findMany({
    where: { officeId: session.officeId, caseId, deletedAt: null },
    orderBy: [{ stageIndex: "asc" }, { createdAt: "asc" }],
    include: {
      documents: {
        where: { deletedAt: null },
        select: { id: true, fileName: true, procedureDocRole: true },
      },
    },
  });
  const events = await prisma.caseEvent.findMany({
    where: { officeId: session.officeId, caseId, procedureRequestId: { in: requests.map((r) => r.id) } },
    orderBy: { occurredAt: "desc" },
  });
  const eventsByRequest = new Map<string, typeof events>();
  for (const e of events) {
    if (!e.procedureRequestId) continue;
    const list = eventsByRequest.get(e.procedureRequestId) ?? [];
    list.push(e);
    eventsByRequest.set(e.procedureRequestId, list);
  }

  const byStage = new Map<number, (typeof requests[number] & { log: typeof events })[]>();
  for (const r of requests) {
    const withLog = { ...r, log: eventsByRequest.get(r.id) ?? [] };
    const list = byStage.get(r.stageIndex) ?? [];
    list.push(withLog);
    byStage.set(r.stageIndex, list);
  }
  return byStage;
}
