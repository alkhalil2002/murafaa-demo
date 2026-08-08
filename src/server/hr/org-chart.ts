import { EmployeeStatus, PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";

/**
 * الهيكل التنظيمي — a read-only grouping of active employees by department
 * (docs/03 has no manager/reportsTo field on Employee, so this stays a flat
 * department grouping rather than a fabricated reporting hierarchy).
 */

export type OrgDepartment = { department: string; employees: { id: string; name: string; jobTitle: string | null }[] };

export async function getOrgChart(session: AppSession): Promise<OrgDepartment[]> {
  await requireModule(session, PermModule.HR, "view");
  const employees = await prisma.employee.findMany({
    where: { officeId: session.officeId, deletedAt: null, status: EmployeeStatus.ACTIVE },
    select: { id: true, name: true, jobTitle: true, department: true },
    orderBy: { name: "asc" },
  });

  const groups = new Map<string, OrgDepartment>();
  for (const e of employees) {
    const dept = e.department ?? "—";
    if (!groups.has(dept)) groups.set(dept, { department: dept, employees: [] });
    groups.get(dept)!.employees.push({ id: e.id, name: e.name, jobTitle: e.jobTitle });
  }
  return Array.from(groups.values()).sort((a, b) => b.employees.length - a.employees.length);
}
