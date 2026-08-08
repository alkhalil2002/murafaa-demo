"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { LeaveType, Role, RequestKind, RequestStatus } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { riyalsToHalalas } from "@/lib/money";
import {
  createAdvance,
  createEmployee,
  createLeave,
  createRequest,
  decideRequest,
  grantEmployeeAccount,
  runPayroll,
  terminateEmployee,
} from "@/server/hr";
import type { AppSession } from "@/lib/auth/types";

/**
 * HR module server actions. Thin wrappers: authenticate, marshal the form, and
 * delegate to the HR services (which own all permission/tenancy/business-rule
 * enforcement). Known domain errors are surfaced back to the page as `?err=`
 * rather than crashing; success revalidates the affected path.
 */

async function run(session: AppSession | null, back: string, fn: (s: AppSession) => Promise<unknown>) {
  if (!session) redirect("/login");
  let err: string | null = null;
  try {
    await fn(session);
  } catch (e) {
    err = e instanceof Error && e.message ? e.message : "ERROR";
  }
  revalidatePath(back);
  // Post/redirect/get for both outcomes: success lands on the clean path (which
  // drops any stale ?err= from a prior failed submit); failure carries the code.
  redirect(err ? `${back}?err=${encodeURIComponent(err)}` : back);
}

const sar = (fd: FormData, k: string) => riyalsToHalalas(num(fd, k, 0));
const str = (fd: FormData, k: string) => {
  const v = (fd.get(k) as string) ?? "";
  return v.trim() === "" ? null : v.trim();
};
/**
 * Parse a numeric field, treating a missing OR empty ("") value as the default.
 * `formData.get()` returns "" (not null) for a present-but-blank field, so a
 * bare `Number(v ?? dflt)` would yield 0 for a cleared input — this restores the
 * intended default instead.
 */
const num = (fd: FormData, k: string, dflt: number) => {
  const v = fd.get(k);
  if (v == null || String(v).trim() === "") return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};

export async function createEmployeeAction(formData: FormData): Promise<void> {
  const session = await getSession();
  await run(session, "/hr", (s) =>
    createEmployee(s, {
      name: String(formData.get("name") ?? "").trim(),
      department: str(formData, "department"),
      jobTitle: str(formData, "jobTitle"),
      nationality: (str(formData, "nationality") ?? "سعودي"),
      nationalId: str(formData, "nationalId"),
      iban: str(formData, "iban"),
      hireDate: new Date(String(formData.get("hireDate") ?? "")),
      basicSalary: sar(formData, "basicSalary"),
      allowances: sar(formData, "allowances"),
      gosiContribution: sar(formData, "gosiContribution"),
      leaveBalanceDays: num(formData, "leaveBalanceDays", 0),
    }),
  );
}

export async function terminateEmployeeAction(formData: FormData): Promise<void> {
  const session = await getSession();
  const id = String(formData.get("employeeId") ?? "");
  await run(session, `/hr/${id}`, (s) => terminateEmployee(s, id));
}

export async function grantEmployeeAccountAction(formData: FormData): Promise<void> {
  const session = await getSession();
  const id = String(formData.get("employeeId") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  const role = roleRaw && roleRaw in Role ? (roleRaw as Role) : Role.RECEPTION;
  await run(session, `/hr/${id}`, (s) => grantEmployeeAccount(s, id, { phone, role }));
}

export async function runPayrollAction(formData: FormData): Promise<void> {
  const session = await getSession();
  const year = num(formData, "year", 0);
  const month = num(formData, "month", 0);
  await run(session, "/hr/payroll", (s) => runPayroll(s, { year, month }));
}

export async function createAdvanceAction(formData: FormData): Promise<void> {
  const session = await getSession();
  await run(session, "/hr/advances", (s) =>
    createAdvance(s, {
      employeeId: String(formData.get("employeeId") ?? ""),
      amount: sar(formData, "amount"),
      months: num(formData, "months", 1),
      note: str(formData, "note"),
    }),
  );
}

export async function createLeaveAction(formData: FormData): Promise<void> {
  const session = await getSession();
  await run(session, "/hr/leaves", (s) =>
    createLeave(s, {
      employeeId: String(formData.get("employeeId") ?? ""),
      type: (String(formData.get("type") ?? LeaveType.ANNUAL) as LeaveType),
      days: num(formData, "days", 0),
      startDate: new Date(String(formData.get("startDate") ?? "")),
      note: str(formData, "note"),
    }),
  );
}

export async function createRequestAction(formData: FormData): Promise<void> {
  const session = await getSession();
  await run(session, "/hr/requests", (s) =>
    createRequest(s, {
      employeeId: String(formData.get("employeeId") ?? ""),
      kind: (String(formData.get("kind") ?? RequestKind.OTHER) as RequestKind),
      detail: str(formData, "detail"),
      days: formData.get("days") ? Number(formData.get("days")) : null,
    }),
  );
}

export async function decideRequestAction(formData: FormData): Promise<void> {
  const session = await getSession();
  const id = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "") as
    | typeof RequestStatus.IN_REVIEW
    | typeof RequestStatus.APPROVED
    | typeof RequestStatus.REJECTED;
  await run(session, "/hr/requests", (s) => decideRequest(s, id, { status }));
}
