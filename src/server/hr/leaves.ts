import { LeaveType, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";

/**
 * Employee leaves (prototype LEAVES). ANNUAL leave draws down the employee's
 * leaveBalanceDays (docs/03) inside a transaction; other leave types are
 * recorded without touching the balance. The balance is guarded non-negative.
 */

const leaveSchema = z.object({
  employeeId: z.string().uuid(),
  type: z.nativeEnum(LeaveType).default(LeaveType.ANNUAL),
  days: z.number().int().positive(),
  startDate: z.coerce.date(),
  note: z.string().nullish(),
});
export type CreateLeaveInput = z.input<typeof leaveSchema>;

export async function createLeave(session: AppSession, raw: CreateLeaveInput) {
  await requireModule(session, PermModule.HR, "edit");
  const input = leaveSchema.parse(raw);
  const deductsBalance = input.type === LeaveType.ANNUAL;

  const leave = await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findFirst({
      where: { id: input.employeeId, officeId: session.officeId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new PermissionError("scope");
    if (deductsBalance) {
      // Atomic conditional decrement: only succeeds if the balance still covers
      // the days. count===0 means insufficient — no TOCTOU, never goes negative.
      const drawn = await tx.employee.updateMany({
        where: {
          id: input.employeeId,
          officeId: session.officeId,
          deletedAt: null,
          leaveBalanceDays: { gte: input.days },
        },
        data: { leaveBalanceDays: { decrement: input.days } },
      });
      if (drawn.count !== 1) throw new Error("LEAVE_BALANCE_INSUFFICIENT");
    }
    return tx.leave.create({
      data: {
        officeId: session.officeId,
        createdById: session.userId,
        employeeId: input.employeeId,
        type: input.type,
        days: input.days,
        startDate: input.startDate,
        note: input.note ?? null,
        deductedBalance: deductsBalance,
      },
    });
  });
  await logAudit({ session, action: "leave.create", resource: "hr", targetId: leave.id });
  return leave;
}

export async function listLeaves(session: AppSession, employeeId?: string) {
  await requireModule(session, PermModule.HR, "view");
  return prisma.leave.findMany({
    where: { officeId: session.officeId, deletedAt: null, ...(employeeId ? { employeeId } : {}) },
    orderBy: { startDate: "desc" },
    include: { employee: { select: { name: true } } },
  });
}
