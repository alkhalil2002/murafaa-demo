import { Injectable } from "@nestjs/common";
import {
  type createAdvanceBody,
  type createLeaveBody,
  type createRequestBody,
  type decideRequestBody,
  type empPortalRequestBody,
  ErrorCode,
} from "@murafaa/contracts";
import {
  advances,
  attendance,
  employeeRequests,
  employees,
  leaves,
  type RequestHistoryEntry,
  type Tx,
} from "@murafaa/database";
import {
  advanceBlocker,
  advanceMonthly,
  advancePosting,
  advanceRemaining,
  type AttendanceStatus,
  leaveApprovalBlocker,
  leaveDeductsBalance,
  requestDecided,
  riyadhCalendarDate,
  stampsCheckIn,
} from "@murafaa/rules";
import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import type { Meta } from "../cases/case-access.service.js";
import { LedgerPoster } from "../finance/ledger-poster.service.js";
import { lockEmployee } from "./employees.service.js";
import { type PortalMeta, portalAudit } from "../../common/audit/portal-audit.js";
import type { PortalPrincipal } from "../../common/tenancy/principal.js";

const conflict = (key: string) => new ApiException(ErrorCode.CONFLICT, undefined, key);
const today = () => riyadhCalendarDate().toISOString().slice(0, 10);

/** A working employee to record against: a terminated one takes no new advances, leaves or requests. */
async function lockWorking(tx: Tx, id: string) {
  const e = await lockEmployee(tx, id);
  if (e.status === "TERMINATED") throw conflict("hr.err.EMPLOYEE_ALREADY_TERMINATED");
  return e;
}

/** Draw annual leave from a locked employee's balance. */
async function drawLeave(tx: Tx, p: Principal, employeeId: string, balance: number, days: number) {
  if (balance < days) throw conflict("hr.err.LEAVE_BALANCE_INSUFFICIENT");
  await tx
    .update(employees)
    .set({ leaveBalanceDays: balance - days, updatedBy: p.userId })
    .where(eq(employees.id, employeeId));
}

/**
 * السُّلف والإجازات والطلبات والحضور (legacy server/hr/advances.ts, leaves.ts,
 * requests.ts, attendance.ts). An advance moves office cash to the employee
 * in the same transaction as its journal entry; payroll repays it.
 */
@Injectable()
export class HrRecordsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly ledger: LedgerPoster,
  ) {}

  // ── Advances (docs/06 §8) ──

  advances(employeeId?: string) {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({ a: advances, employeeName: employees.name })
        .from(advances)
        .innerJoin(employees, eq(employees.id, advances.employeeId))
        .where(
          and(
            isNull(advances.deletedAt),
            employeeId ? eq(advances.employeeId, employeeId) : undefined,
          ),
        )
        .orderBy(desc(advances.advanceDate), desc(advances.createdAt));
      return rows.map(({ a, employeeName }) => ({
        id: a.id,
        employeeId: a.employeeId,
        employeeName,
        amount: a.amount,
        months: a.months,
        paid: a.paid,
        monthlyDue: advanceMonthly(a),
        remaining: advanceRemaining(a),
        advanceDate: a.advanceDate,
        status: a.status,
        note: a.note,
      }));
    });
  }

  createAdvance(p: Principal, input: z.infer<typeof createAdvanceBody>, meta: Meta) {
    const blocker = advanceBlocker({
      amount: input.amount,
      monthlyInstallment: input.monthlyInstallment ?? null,
      months: input.months,
    });
    if (blocker) throw conflict(`hr.err.${blocker}`);
    const advanceDate = input.advanceDate ?? today();
    return this.tenantDb.run(async (tx) => {
      const e = await lockWorking(tx, input.employeeId);
      const [row] = await tx
        .insert(advances)
        .values({
          officeId: p.officeId,
          employeeId: e.id,
          amount: input.amount,
          months: input.months,
          monthlyInstallment: input.monthlyInstallment ?? null,
          advanceDate,
          note: input.note,
          createdBy: p.userId,
        })
        .returning({ id: advances.id });
      await this.ledger.post(tx, p.officeId, p.userId, {
        date: new Date(`${advanceDate}T00:00:00.000Z`),
        descriptionKey: "journal.advance",
        params: { name: e.name },
        sourceType: "PAYROLL",
        sourceId: row!.id,
        lines: advancePosting(input.amount),
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "advance.create",
        entity: "advances",
        entityId: row!.id,
        after: { employeeId: e.id, amount: input.amount, months: input.months },
        ...meta,
      });
      return { id: row!.id };
    });
  }

  // ── Leaves ──

  leaves(employeeId?: string) {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({ l: leaves, employeeName: employees.name })
        .from(leaves)
        .innerJoin(employees, eq(employees.id, leaves.employeeId))
        .where(
          and(isNull(leaves.deletedAt), employeeId ? eq(leaves.employeeId, employeeId) : undefined),
        )
        .orderBy(desc(leaves.startDate), desc(leaves.createdAt));
      return rows.map(({ l, employeeName }) => ({
        id: l.id,
        employeeId: l.employeeId,
        employeeName,
        type: l.type,
        days: l.days,
        startDate: l.startDate,
        note: l.note,
      }));
    });
  }

  /** Annual leave draws down the balance under the employee's row lock, never below zero. */
  createLeave(p: Principal, input: z.infer<typeof createLeaveBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const e = await lockWorking(tx, input.employeeId);
      const deducts = leaveDeductsBalance(input.type);
      if (deducts) await drawLeave(tx, p, e.id, e.leaveBalanceDays, input.days);
      const [row] = await tx
        .insert(leaves)
        .values({
          officeId: p.officeId,
          employeeId: e.id,
          type: input.type,
          days: input.days,
          startDate: input.startDate,
          note: input.note,
          deductedBalance: deducts,
          createdBy: p.userId,
        })
        .returning({ id: leaves.id });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "leave.create",
        entity: "leaves",
        entityId: row!.id,
        after: { employeeId: e.id, type: input.type, days: input.days },
        ...meta,
      });
      return { id: row!.id };
    });
  }

  // ── Employee requests ──

  requests() {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({ r: employeeRequests, employeeName: employees.name })
        .from(employeeRequests)
        .innerJoin(employees, eq(employees.id, employeeRequests.employeeId))
        .where(isNull(employeeRequests.deletedAt))
        .orderBy(desc(employeeRequests.createdAt));
      return rows.map(({ r, employeeName }) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName,
        kind: r.kind,
        detail: r.detail,
        days: r.days,
        status: r.status,
        history: r.history as Array<RequestHistoryEntry & { status: typeof r.status }>,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }

  createRequest(p: Principal, input: z.infer<typeof createRequestBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const e = await lockWorking(tx, input.employeeId);
      const [row] = await tx
        .insert(employeeRequests)
        .values({
          officeId: p.officeId,
          employeeId: e.id,
          kind: input.kind,
          detail: input.detail,
          days: input.days ?? null,
          department: input.department ?? e.department,
          history: [{ status: "SUBMITTED", by: p.userId, at: new Date().toISOString() }],
          createdBy: p.userId,
        })
        .returning({ id: employeeRequests.id });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "empRequest.create",
        entity: "employee_requests",
        entityId: row!.id,
        after: { employeeId: e.id, kind: input.kind },
        ...meta,
      });
      return { id: row!.id };
    });
  }

  /** بوابة الموظف: the employee's own requests. */
  selfRequests(employeeId: string) {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select()
        .from(employeeRequests)
        .where(and(eq(employeeRequests.employeeId, employeeId), isNull(employeeRequests.deletedAt)))
        .orderBy(desc(employeeRequests.createdAt));
      return rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        detail: r.detail,
        days: r.days,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }

  /** A request the employee files from the portal; HR decides it at /hr/requests (legacy). */
  selfSubmit(who: PortalPrincipal, input: z.infer<typeof empPortalRequestBody>, meta: PortalMeta) {
    return this.tenantDb.run(async (tx) => {
      const e = await lockWorking(tx, who.subjectId);
      const [row] = await tx
        .insert(employeeRequests)
        .values({
          officeId: who.officeId,
          employeeId: e.id,
          kind: input.kind,
          detail: input.detail,
          days: input.days ?? null,
          department: e.department,
          // "by" is the employee's id: the request came from the employee themself.
          history: [{ status: "SUBMITTED", by: e.id, at: new Date().toISOString() }],
        })
        .returning({ id: employeeRequests.id });
      await portalAudit(tx, who, meta, {
        action: "empRequest.selfSubmit",
        entity: "employee_requests",
        entityId: row!.id,
        after: { kind: input.kind },
      });
      return { id: row!.id };
    });
  }

  /**
   * A decision appends to the trail under a row lock; a decided request is
   * final. Approving a leave request takes effect: it records the annual
   * leave and draws the balance (legacy).
   */
  decideRequest(p: Principal, id: string, input: z.infer<typeof decideRequestBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [r] = await tx
        .select()
        .from(employeeRequests)
        .where(and(eq(employeeRequests.id, id), isNull(employeeRequests.deletedAt)))
        .for("update");
      if (!r) throw new ApiException(ErrorCode.NOT_FOUND);
      if (requestDecided(r.status)) throw conflict("hr.err.REQUEST_ALREADY_DECIDED");
      if (input.status === "APPROVED" && r.kind === "LEAVE") {
        const e = await lockWorking(tx, r.employeeId);
        const blocker = leaveApprovalBlocker(r.days, e.leaveBalanceDays);
        if (blocker) throw conflict(`hr.err.${blocker}`);
        await drawLeave(tx, p, e.id, e.leaveBalanceDays, r.days!);
        await tx.insert(leaves).values({
          officeId: p.officeId,
          employeeId: e.id,
          type: "ANNUAL",
          days: r.days!,
          startDate: today(),
          note: r.detail,
          deductedBalance: true,
          createdBy: p.userId,
        });
      }
      const entry: RequestHistoryEntry = {
        status: input.status,
        by: p.userId,
        at: new Date().toISOString(),
        ...(input.note ? { note: input.note } : {}),
      };
      await tx
        .update(employeeRequests)
        .set({ status: input.status, history: [...r.history, entry], updatedBy: p.userId })
        .where(eq(employeeRequests.id, id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "empRequest.decide",
        entity: "employee_requests",
        entityId: id,
        after: { status: input.status },
        ...meta,
      });
    });
  }

  // ── Attendance (raw day counts only: docs/06 has no deduction formula) ──

  attendanceToday() {
    const day = today();
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({
          employeeId: employees.id,
          employeeName: employees.name,
          status: attendance.status,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
        })
        .from(employees)
        .leftJoin(
          attendance,
          and(
            eq(attendance.employeeId, employees.id),
            eq(attendance.day, day),
            isNull(attendance.deletedAt),
          ),
        )
        .where(and(isNull(employees.deletedAt), eq(employees.status, "ACTIVE")))
        .orderBy(asc(employees.name));
      return {
        day,
        rows: rows.map((r) => ({
          ...r,
          checkIn: r.checkIn?.toISOString() ?? null,
          checkOut: r.checkOut?.toISOString() ?? null,
        })),
      };
    });
  }

  /** Today's status; present or late stamps the first check-in and never moves it. */
  setAttendance(p: Principal, employeeId: string, status: AttendanceStatus, meta: Meta) {
    const day = today();
    return this.tenantDb.run(async (tx) => {
      const e = await lockWorking(tx, employeeId);
      const stamp = stampsCheckIn(status) ? sql`now()` : null;
      await tx
        .insert(attendance)
        .values({
          officeId: p.officeId,
          employeeId: e.id,
          day,
          status,
          checkIn: stamp,
          createdBy: p.userId,
        })
        .onConflictDoUpdate({
          target: [attendance.officeId, attendance.employeeId, attendance.day],
          set: {
            status,
            checkIn: stamp
              ? sql`coalesce(${attendance.checkIn}, now())`
              : sql`${attendance.checkIn}`,
            updatedBy: p.userId,
            updatedAt: sql`now()`,
          },
        });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "attendance.setStatus",
        entity: "attendance",
        entityId: e.id,
        after: { day, status },
        ...meta,
      });
    });
  }

  clockOut(p: Principal, employeeId: string, meta: Meta) {
    const day = today();
    return this.tenantDb.run(async (tx) => {
      const updated = await tx
        .update(attendance)
        .set({ checkOut: sql`now()`, updatedBy: p.userId })
        .where(
          and(
            eq(attendance.employeeId, employeeId),
            eq(attendance.day, day),
            isNull(attendance.deletedAt),
          ),
        )
        .returning({ id: attendance.id });
      // Nothing recorded today: there is no check-in to close.
      if (updated.length === 0) throw new ApiException(ErrorCode.NOT_FOUND);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "attendance.clockOut",
        entity: "attendance",
        entityId: employeeId,
        after: { day },
        ...meta,
      });
    });
  }

  /** `month` is YYYY-MM, default the current Riyadh month. */
  attendanceMonth(month?: string) {
    const m = month ?? today().slice(0, 7);
    const [y, mo] = m.split("-").map(Number) as [number, number];
    const start = `${m}-01`;
    const end = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
    return this.tenantDb.run(async (tx) => {
      const staff = await tx
        .select({ id: employees.id, name: employees.name })
        .from(employees)
        .where(and(isNull(employees.deletedAt), eq(employees.status, "ACTIVE")))
        .orderBy(asc(employees.name));
      const rows = await tx
        .select({ employeeId: attendance.employeeId, status: attendance.status })
        .from(attendance)
        .where(
          and(isNull(attendance.deletedAt), gte(attendance.day, start), lt(attendance.day, end)),
        );
      const countOf = (id: string, s: AttendanceStatus) =>
        rows.filter((r) => r.employeeId === id && r.status === s).length;
      return {
        month: m,
        rows: staff.map((e) => ({
          employeeId: e.id,
          employeeName: e.name,
          daysPresent: countOf(e.id, "PRESENT"),
          lateCount: countOf(e.id, "LATE"),
          daysAbsent: countOf(e.id, "ABSENT"),
        })),
      };
    });
  }
}
