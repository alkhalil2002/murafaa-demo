import { Prisma, RequestKind, RequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logSystemAudit } from "@/lib/audit";
import type { EmpPortalSession } from "@/lib/auth/emp-portal-session";

/**
 * بوابة الموظف (docs/01 §employee self-service, docs/05 `empportal`) —
 * scoped strictly to what the docs define: طلبات، سُلف، إجازات، خطابات
 * تعريف. No department-manager approval delegation is built here — the
 * data model (docs/03) has no manager/reportsTo hierarchy on Employee, so
 * that prototype embellishment has no real field to key off; per CLAUDE.md
 * "docs > prototype", approval stays HR-side (already built at /hr/requests).
 */

type HistoryEntry = { status: RequestStatus; by: string; at: string };

export type EmpPortalProfile = {
  id: string;
  name: string;
  jobTitle: string | null;
  department: string | null;
  leaveBalanceDays: number;
  performanceScore: number | null;
};

async function loadEmployee(session: EmpPortalSession) {
  const employee = await prisma.employee.findFirst({
    where: { id: session.employeeId, officeId: session.officeId, deletedAt: null },
  });
  if (!employee) throw new Error("EMPLOYEE_NOT_FOUND");
  return employee;
}

export async function getEmpPortalProfile(session: EmpPortalSession): Promise<EmpPortalProfile> {
  const e = await loadEmployee(session);
  return {
    id: e.id,
    name: e.name,
    jobTitle: e.jobTitle,
    department: e.department,
    leaveBalanceDays: e.leaveBalanceDays,
    performanceScore: e.performanceScore,
  };
}

export async function listMyRequests(session: EmpPortalSession) {
  await loadEmployee(session);
  return prisma.employeeRequest.findMany({
    where: { officeId: session.officeId, employeeId: session.employeeId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

const submitSchema = z.object({
  kind: z.nativeEnum(RequestKind),
  detail: z.string().nullish(),
  days: z.number().int().positive().nullish(),
});
export type SubmitEmpRequestInput = z.input<typeof submitSchema>;

export async function submitEmpRequest(session: EmpPortalSession, raw: SubmitEmpRequestInput) {
  const employee = await loadEmployee(session);
  const input = submitSchema.parse(raw);
  if (input.kind === RequestKind.LEAVE && !input.days) {
    throw new Error("LEAVE_REQUEST_MISSING_DAYS");
  }

  const first: HistoryEntry = { status: RequestStatus.SUBMITTED, by: "employee", at: new Date().toISOString() };
  const request = await prisma.employeeRequest.create({
    data: {
      officeId: session.officeId,
      employeeId: employee.id,
      department: employee.department,
      kind: input.kind,
      detail: input.detail ?? null,
      days: input.days ?? null,
      status: RequestStatus.SUBMITTED,
      history: [first] as unknown as Prisma.InputJsonValue,
    },
  });
  await logSystemAudit(
    session.officeId,
    "empRequest.selfSubmit",
    `employee=${employee.id} kind=${input.kind} request=${request.id}`,
  );
  return request;
}
