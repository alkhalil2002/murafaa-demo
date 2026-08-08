import { EmployeeStatus, PermModule, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { MAX_HALALAS } from "@/lib/finance/core";
import { endOfServiceAward, serviceYears } from "@/lib/hr/core";
import { normalizeSaudiPhone } from "@/lib/auth/phone";

/**
 * Employees (prototype EMPLOYEES + EMP_EXTRA). HR-gated (الموارد البشرية):
 * PARTNER (full) and ADMIN (edit) manage staff; reads require view. Money fields
 * are integer halalas; nationality + hireDate feed EOS (docs/06 §5) and
 * Saudization (docs/06 §6).
 */

const money = z.number().int().nonnegative().max(MAX_HALALAS);

const employeeSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullish(),
  department: z.string().nullish(),
  jobTitle: z.string().nullish(),
  nationality: z.string().min(1).default("سعودي"),
  nationalId: z.string().nullish(),
  iban: z.string().nullish(),
  hireDate: z.coerce.date(),
  basicSalary: money,
  allowances: money.default(0),
  gosiContribution: money.default(0),
  leaveBalanceDays: z.number().int().nonnegative().default(0),
  performanceScore: z.number().int().min(0).max(100).nullish(),
  userId: z.string().uuid().nullish(),
});
export type CreateEmployeeInput = z.input<typeof employeeSchema>;

export async function createEmployee(session: AppSession, raw: CreateEmployeeInput) {
  await requireModule(session, PermModule.HR, "edit");
  const input = employeeSchema.parse(raw);

  // Tenancy: a linked login account must belong to this office and be unclaimed.
  if (input.userId) {
    const u = await prisma.user.findFirst({
      where: { id: input.userId, officeId: session.officeId, deletedAt: null },
      select: { id: true },
    });
    if (!u) throw new PermissionError("scope");
  }

  const phone = input.phone ? normalizeSaudiPhone(input.phone) : null;
  if (input.phone && !phone) throw new Error("PHONE_INVALID");

  const employee = await prisma.employee.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      name: input.name,
      phone,
      department: input.department ?? null,
      jobTitle: input.jobTitle ?? null,
      nationality: input.nationality,
      nationalId: input.nationalId ?? null,
      iban: input.iban ?? null,
      hireDate: input.hireDate,
      basicSalary: input.basicSalary,
      allowances: input.allowances,
      gosiContribution: input.gosiContribution,
      leaveBalanceDays: input.leaveBalanceDays,
      performanceScore: input.performanceScore ?? null,
      userId: input.userId ?? null,
    },
  });
  await logAudit({ session, action: "employee.create", resource: "hr", targetId: employee.id });
  return employee;
}

export async function listEmployees(session: AppSession) {
  await requireModule(session, PermModule.HR, "view");
  return prisma.employee.findMany({
    where: { officeId: session.officeId, deletedAt: null },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function getEmployee(session: AppSession, employeeId: string) {
  await requireModule(session, PermModule.HR, "view");
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, officeId: session.officeId, deletedAt: null },
    include: {
      advances: { where: { deletedAt: null }, orderBy: { advanceDate: "desc" } },
      leaves: { where: { deletedAt: null }, orderBy: { startDate: "desc" } },
      requests: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      user: { select: { name: true, phone: true, role: true, isActive: true } },
    },
  });
  if (!employee) throw new PermissionError("scope");
  return employee;
}

const grantAccountSchema = z.object({
  phone: z.string().min(1),
  role: z.nativeEnum(Role),
});

/** Provision a system-login account for an employee (prototype "منح حساب نظام + دور").
 * FULL-level HR action (partner-only by default) since this grants module access,
 * not just an HR record edit. Creates a new User linked via Employee.userId. */
export async function grantEmployeeAccount(session: AppSession, employeeId: string, raw: z.infer<typeof grantAccountSchema>) {
  await requireModule(session, PermModule.HR, "delete");
  const input = grantAccountSchema.parse(raw);
  const phone = normalizeSaudiPhone(input.phone);
  if (!phone) throw new Error("PHONE_INVALID");

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, officeId: session.officeId, deletedAt: null },
    select: { id: true, name: true, userId: true },
  });
  if (!employee) throw new PermissionError("scope");
  if (employee.userId) throw new Error("EMPLOYEE_ALREADY_HAS_ACCOUNT");

  const existingUser = await prisma.user.findFirst({
    where: { officeId: session.officeId, phone, deletedAt: null },
    select: { id: true },
  });
  if (existingUser) throw new Error("PHONE_ALREADY_IN_USE");

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { officeId: session.officeId, createdById: session.userId, name: employee.name, phone, role: input.role },
    });
    await tx.employee.update({ where: { id: employeeId }, data: { userId: created.id } });
    return created;
  });
  await logAudit({ session, action: "employee.grantAccount", resource: "hr", targetId: employeeId, detail: user.id });
  return user;
}

const updateSchema = employeeSchema.partial().omit({ userId: true });
export type UpdateEmployeeInput = z.input<typeof updateSchema>;

export async function updateEmployee(session: AppSession, employeeId: string, raw: UpdateEmployeeInput) {
  await requireModule(session, PermModule.HR, "edit");
  const input = updateSchema.parse(raw);
  const existing = await prisma.employee.findFirst({
    where: { id: employeeId, officeId: session.officeId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new PermissionError("scope");

  let normalizedPhone: string | null | undefined;
  if (input.phone !== undefined) {
    normalizedPhone = input.phone ? normalizeSaudiPhone(input.phone) : null;
    if (input.phone && !normalizedPhone) throw new Error("PHONE_INVALID");
  }

  const employee = await prisma.employee.update({
    where: { id: employeeId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: normalizedPhone } : {}),
      ...(input.department !== undefined ? { department: input.department ?? null } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle ?? null } : {}),
      ...(input.nationality !== undefined ? { nationality: input.nationality } : {}),
      ...(input.nationalId !== undefined ? { nationalId: input.nationalId ?? null } : {}),
      ...(input.iban !== undefined ? { iban: input.iban ?? null } : {}),
      ...(input.hireDate !== undefined ? { hireDate: input.hireDate } : {}),
      ...(input.basicSalary !== undefined ? { basicSalary: input.basicSalary } : {}),
      ...(input.allowances !== undefined ? { allowances: input.allowances } : {}),
      ...(input.gosiContribution !== undefined ? { gosiContribution: input.gosiContribution } : {}),
      ...(input.leaveBalanceDays !== undefined ? { leaveBalanceDays: input.leaveBalanceDays } : {}),
      ...(input.performanceScore !== undefined ? { performanceScore: input.performanceScore ?? null } : {}),
    },
  });
  await logAudit({ session, action: "employee.update", resource: "hr", targetId: employeeId });
  return employee;
}

/**
 * End-of-service preview (docs/06 §5) — pure computation, no writes. `asOf`
 * defaults to now; years = asOf calendar year − hire year.
 */
export function previewEndOfService(
  employee: { basicSalary: number; allowances: number; hireDate: Date },
  asOf: Date = new Date(),
): { years: number; awardMinor: number } {
  const years = serviceYears(employee.hireDate.getUTCFullYear(), asOf.getUTCFullYear());
  const awardMinor = endOfServiceAward({
    basicSalary: employee.basicSalary,
    allowances: employee.allowances,
    years,
  });
  return { years, awardMinor };
}

/**
 * Terminate an employee and freeze their computed end-of-service award
 * (docs/06 §5). Delete-class action → requires full HR (PARTNER). Idempotent:
 * re-terminating an already-terminated employee is rejected.
 */
export async function terminateEmployee(session: AppSession, employeeId: string, asOf: Date = new Date()) {
  await requireModule(session, PermModule.HR, "delete");
  const existing = await prisma.employee.findFirst({
    where: { id: employeeId, officeId: session.officeId, deletedAt: null },
  });
  if (!existing) throw new PermissionError("scope");
  if (existing.status === EmployeeStatus.TERMINATED) throw new Error("EMPLOYEE_ALREADY_TERMINATED");

  const { years, awardMinor } = previewEndOfService(existing, asOf);
  const employee = await prisma.employee.update({
    where: { id: employeeId },
    data: { status: EmployeeStatus.TERMINATED, terminatedAt: asOf, endOfServiceMinor: awardMinor },
  });
  await logAudit({
    session,
    action: "employee.terminate",
    resource: "hr",
    targetId: employeeId,
    detail: `${years}y → ${awardMinor} halalas`,
  });
  return employee;
}
