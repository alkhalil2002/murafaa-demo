import { AttendanceStatus, EmployeeStatus, PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";
import { logAudit } from "@/lib/audit";
import { now, riyadhCalendarDate } from "@/lib/dates";

/**
 * الحضور والانصراف (docs/05 hrAtt). Daily check-in/status per active
 * employee, with a monthly summary aggregated live from those rows.
 * docs/06 has no documented absence/lateness deduction formula, so this
 * deliberately stops at raw day counts — it does not compute or feed a
 * halalas figure into payroll (that would be inventing a business rule,
 * not implementing one).
 */

export type TodayAttendanceRow = {
  employeeId: string;
  employeeName: string;
  status: AttendanceStatus | null;
  checkIn: Date | null;
  checkOut: Date | null;
};

export async function getTodayAttendance(session: AppSession): Promise<TodayAttendanceRow[]> {
  await requireModule(session, PermModule.HR, "view");
  const today = riyadhCalendarDate(now());

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({
      where: { officeId: session.officeId, deletedAt: null, status: EmployeeStatus.ACTIVE },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendance.findMany({
      where: { officeId: session.officeId, date: today, deletedAt: null },
    }),
  ]);
  const byEmployee = new Map(records.map((r) => [r.employeeId, r]));

  return employees.map((e) => {
    const r = byEmployee.get(e.id);
    return {
      employeeId: e.id,
      employeeName: e.name,
      status: r?.status ?? null,
      checkIn: r?.checkIn ?? null,
      checkOut: r?.checkOut ?? null,
    };
  });
}

export async function setTodayStatus(
  session: AppSession,
  employeeId: string,
  status: AttendanceStatus,
): Promise<void> {
  await requireModule(session, PermModule.HR, "edit");
  const today = riyadhCalendarDate(now());
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, officeId: session.officeId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) throw new Error("EMPLOYEE_NOT_FOUND");

  const existing = await prisma.attendance.findUnique({
    where: { officeId_employeeId_date: { officeId: session.officeId, employeeId, date: today } },
  });
  await prisma.attendance.upsert({
    where: { officeId_employeeId_date: { officeId: session.officeId, employeeId, date: today } },
    create: {
      officeId: session.officeId,
      createdById: session.userId,
      employeeId,
      date: today,
      status,
      checkIn: status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE ? now() : null,
    },
    update: {
      status,
      checkIn:
        !existing?.checkIn && (status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE)
          ? now()
          : existing?.checkIn,
    },
  });
  await logAudit({ session, action: "attendance.setStatus", resource: "hr", targetId: employeeId, detail: status });
}

export async function clockOut(session: AppSession, employeeId: string): Promise<void> {
  await requireModule(session, PermModule.HR, "edit");
  const today = riyadhCalendarDate(now());
  await prisma.attendance.updateMany({
    where: { officeId: session.officeId, employeeId, date: today, deletedAt: null },
    data: { checkOut: now() },
  });
  await logAudit({ session, action: "attendance.clockOut", resource: "hr", targetId: employeeId });
}

export type MonthlyAttendanceRow = {
  employeeId: string;
  employeeName: string;
  daysPresent: number;
  lateCount: number;
  daysAbsent: number;
};

/** `month` as "YYYY-MM"; defaults to the current Riyadh month. */
export async function getMonthlySummary(session: AppSession, month?: string): Promise<MonthlyAttendanceRow[]> {
  await requireModule(session, PermModule.HR, "view");
  const base = month ? new Date(`${month}-01T00:00:00`) : riyadhCalendarDate(now());
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({
      where: { officeId: session.officeId, deletedAt: null, status: EmployeeStatus.ACTIVE },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendance.findMany({
      where: { officeId: session.officeId, deletedAt: null, date: { gte: start, lt: end } },
      select: { employeeId: true, status: true },
    }),
  ]);

  return employees.map((e) => {
    const rows = records.filter((r) => r.employeeId === e.id);
    return {
      employeeId: e.id,
      employeeName: e.name,
      daysPresent: rows.filter((r) => r.status === AttendanceStatus.PRESENT).length,
      lateCount: rows.filter((r) => r.status === AttendanceStatus.LATE).length,
      daysAbsent: rows.filter((r) => r.status === AttendanceStatus.ABSENT).length,
    };
  });
}
