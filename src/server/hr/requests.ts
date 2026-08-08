import { LeaveType, Prisma, RequestKind, RequestStatus, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";

/**
 * Employee self-service requests (prototype EMP_REQUESTS): leave, advance,
 * certificate, etc. `history` is an append-only audit trail of status changes,
 * so a decision never overwrites the prior stage.
 */

type HistoryEntry = { status: RequestStatus; by: string; at: string; note?: string };

const requestSchema = z.object({
  employeeId: z.string().uuid(),
  kind: z.nativeEnum(RequestKind),
  detail: z.string().nullish(),
  days: z.number().int().positive().nullish(),
  department: z.string().nullish(),
});
export type CreateRequestInput = z.input<typeof requestSchema>;

export async function createRequest(session: AppSession, raw: CreateRequestInput) {
  await requireModule(session, PermModule.HR, "edit");
  const input = requestSchema.parse(raw);
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, officeId: session.officeId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) throw new PermissionError("scope");

  const first: HistoryEntry = {
    status: RequestStatus.SUBMITTED,
    by: session.userId,
    at: new Date().toISOString(),
  };
  const request = await prisma.employeeRequest.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      employeeId: input.employeeId,
      kind: input.kind,
      detail: input.detail ?? null,
      days: input.days ?? null,
      department: input.department ?? null,
      status: RequestStatus.SUBMITTED,
      history: [first] as unknown as Prisma.InputJsonValue,
    },
  });
  await logAudit({ session, action: "empRequest.create", resource: "hr", targetId: request.id });
  return request;
}

const decideSchema = z.object({
  status: z.enum([RequestStatus.IN_REVIEW, RequestStatus.APPROVED, RequestStatus.REJECTED]),
  note: z.string().nullish(),
});
export type DecideRequestInput = z.input<typeof decideSchema>;

export async function decideRequest(session: AppSession, requestId: string, raw: DecideRequestInput) {
  await requireModule(session, PermModule.HR, "edit");
  const input = decideSchema.parse(raw);

  const request = await prisma.$transaction(async (tx) => {
    // Lock the row for the transaction so two concurrent decisions serialize —
    // the append-to-history read-modify-write can't lose an entry or clobber
    // status (the second decider blocks, then reads the committed history).
    await tx.$queryRaw`SELECT id FROM employee_requests WHERE id = ${requestId}::uuid AND office_id = ${session.officeId}::uuid FOR UPDATE`;
    const existing = await tx.employeeRequest.findFirst({
      where: { id: requestId, officeId: session.officeId, deletedAt: null },
    });
    if (!existing) throw new PermissionError("scope");
    // A decided (approved/rejected) request is terminal — do not re-decide.
    if (existing.status === RequestStatus.APPROVED || existing.status === RequestStatus.REJECTED) {
      throw new Error("REQUEST_ALREADY_DECIDED");
    }
    const prior = Array.isArray(existing.history) ? (existing.history as unknown as HistoryEntry[]) : [];
    const entry: HistoryEntry = {
      status: input.status,
      by: session.userId,
      at: new Date().toISOString(),
      ...(input.note ? { note: input.note } : {}),
    };

    // Approving a LEAVE request must actually take effect — create the real
    // Leave record (which deducts leaveBalanceDays for ANNUAL type) rather
    // than just flipping this request's status. Without `days` there is
    // nothing to deduct, so surface that clearly instead of silently
    // approving a request that changes nothing.
    if (input.status === RequestStatus.APPROVED && existing.kind === RequestKind.LEAVE) {
      if (!existing.days) throw new Error("LEAVE_REQUEST_MISSING_DAYS");
      const drawn = await tx.employee.updateMany({
        where: {
          id: existing.employeeId,
          officeId: session.officeId,
          deletedAt: null,
          leaveBalanceDays: { gte: existing.days },
        },
        data: { leaveBalanceDays: { decrement: existing.days } },
      });
      if (drawn.count !== 1) throw new Error("LEAVE_BALANCE_INSUFFICIENT");
      await tx.leave.create({
        data: {
          officeId: session.officeId,
          createdById: session.userId,
          employeeId: existing.employeeId,
          type: LeaveType.ANNUAL,
          days: existing.days,
          startDate: new Date(),
          note: existing.detail,
          deductedBalance: true,
        },
      });
    }

    return tx.employeeRequest.update({
      where: { id: requestId },
      data: {
        status: input.status,
        history: [...prior, entry] as unknown as Prisma.InputJsonValue,
      },
    });
  });
  await logAudit({
    session,
    action: "empRequest.decide",
    resource: "hr",
    targetId: requestId,
    detail: input.status,
  });
  return request;
}

export async function listRequests(session: AppSession, employeeId?: string) {
  await requireModule(session, PermModule.HR, "view");
  return prisma.employeeRequest.findMany({
    where: { officeId: session.officeId, deletedAt: null, ...(employeeId ? { employeeId } : {}) },
    orderBy: { createdAt: "desc" },
    include: { employee: { select: { name: true } } },
  });
}
