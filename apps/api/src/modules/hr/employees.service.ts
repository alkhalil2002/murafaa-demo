import { Injectable } from "@nestjs/common";
import { Role } from "@murafaa/auth";
import {
  type createEmployeeBody,
  ErrorCode,
  type grantAccountBody,
  type updateEmployeeBody,
} from "@murafaa/contracts";
import { advances, employeeRequests, employees, leaves, type Tx, users } from "@murafaa/database";
import {
  advanceMonthly,
  advanceRemaining,
  endOfServiceAward,
  isSaudi,
  maskIban,
  NITAQAT_BANDS,
  nitaqatBand,
  riyadhCalendarDate,
  saudisNeeded,
  saudizationPct,
  serviceYears,
} from "@murafaa/rules";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { isUniqueViolation } from "../../common/db/pg-errors.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import type { Meta } from "../cases/case-access.service.js";

const conflict = (key: string) => new ApiException(ErrorCode.CONFLICT, undefined, key);

/** End of service if the employee left on `asOf` (docs/06 §5: calendar-year difference). */
export function endOfServiceAt(
  e: { basicSalary: number; allowances: number; hireDate: string },
  asOf: Date,
) {
  const years = serviceYears(Number(e.hireDate.slice(0, 4)), asOf.getUTCFullYear());
  return {
    years,
    awardMinor: endOfServiceAward({ basicSalary: e.basicSalary, allowances: e.allowances, years }),
  };
}

/** A row of this office's employees, locked for the caller's change, or 404. */
export async function lockEmployee(tx: Tx, id: string) {
  const [e] = await tx
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
    .for("update");
  if (!e) throw new ApiException(ErrorCode.NOT_FOUND);
  return e;
}

/**
 * الموظفون (legacy server/hr/employees.ts, org-chart.ts, saudization.ts).
 * Salaries are halalas; nationality and hire date feed end of service and
 * Nitaqat.
 */
@Injectable()
export class EmployeesService {
  constructor(private readonly tenantDb: TenantDb) {}

  list() {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select()
        .from(employees)
        .where(isNull(employees.deletedAt))
        .orderBy(asc(employees.status), asc(employees.name));
      return rows.map((e) => ({
        id: e.id,
        name: e.name,
        department: e.department,
        jobTitle: e.jobTitle,
        nationality: e.nationality,
        hireDate: e.hireDate,
        status: e.status,
        basicSalary: e.basicSalary,
        allowances: e.allowances,
        performanceScore: e.performanceScore,
      }));
    });
  }

  detail(id: string) {
    return this.tenantDb.run(async (tx) => {
      const [e] = await tx
        .select()
        .from(employees)
        .where(and(eq(employees.id, id), isNull(employees.deletedAt)));
      if (!e) throw new ApiException(ErrorCode.NOT_FOUND);
      const [account] = e.userId
        ? await tx
            .select({
              name: users.name,
              phone: users.phone,
              role: users.role,
              isActive: users.isActive,
            })
            .from(users)
            .where(eq(users.id, e.userId))
        : [];
      const adv = await tx
        .select()
        .from(advances)
        .where(and(eq(advances.employeeId, id), isNull(advances.deletedAt)))
        .orderBy(desc(advances.advanceDate));
      const lv = await tx
        .select()
        .from(leaves)
        .where(and(eq(leaves.employeeId, id), isNull(leaves.deletedAt)))
        .orderBy(desc(leaves.startDate));
      const req = await tx
        .select()
        .from(employeeRequests)
        .where(and(eq(employeeRequests.employeeId, id), isNull(employeeRequests.deletedAt)))
        .orderBy(desc(employeeRequests.createdAt));
      const frozen = e.status === "TERMINATED";
      const eos = frozen
        ? { years: null, awardMinor: e.endOfServiceMinor ?? 0 }
        : endOfServiceAt(e, riyadhCalendarDate());
      return {
        id: e.id,
        name: e.name,
        department: e.department,
        jobTitle: e.jobTitle,
        nationality: e.nationality,
        hireDate: e.hireDate,
        status: e.status,
        basicSalary: e.basicSalary,
        allowances: e.allowances,
        gosiContribution: e.gosiContribution,
        leaveBalanceDays: e.leaveBalanceDays,
        performanceScore: e.performanceScore,
        ibanMasked: e.iban ? maskIban(e.iban) : null,
        terminatedAt: e.terminatedAt?.toISOString() ?? null,
        endOfService: { ...eos, frozen },
        account: account ?? null,
        advances: adv.map((a) => ({
          id: a.id,
          amount: a.amount,
          status: a.status,
          monthlyDue: advanceMonthly(a),
          remaining: advanceRemaining(a),
        })),
        leaves: lv.map((l) => ({ id: l.id, type: l.type, days: l.days, startDate: l.startDate })),
        requests: req.map((r) => ({ id: r.id, kind: r.kind, status: r.status, detail: r.detail })),
      };
    });
  }

  create(p: Principal, input: z.infer<typeof createEmployeeBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [created] = await tx
        .insert(employees)
        .values({ officeId: p.officeId, ...input, createdBy: p.userId })
        .returning({ id: employees.id });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "employee.create",
        entity: "employees",
        entityId: created!.id,
        ...meta,
      });
      return { id: created!.id };
    });
  }

  update(p: Principal, id: string, input: z.infer<typeof updateEmployeeBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      await lockEmployee(tx, id);
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined),
      ) as Partial<typeof employees.$inferInsert>;
      await tx
        .update(employees)
        .set({ ...changes, updatedBy: p.userId })
        .where(eq(employees.id, id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "employee.update",
        entity: "employees",
        entityId: id,
        // Field names only: salaries and identifiers stay out of the audit log.
        after: { fields: Object.keys(changes) },
        ...meta,
      });
    });
  }

  /**
   * منح حساب نظام + دور (full HR level). Only a real partner may hand out the
   * partner role: an office that gives another role full HR must not let it
   * mint partners (legacy allowed any role).
   */
  async grantAccount(
    p: Principal,
    id: string,
    input: z.infer<typeof grantAccountBody>,
    meta: Meta,
  ) {
    if (input.role === Role.PARTNER && p.role !== Role.PARTNER)
      throw new ApiException(ErrorCode.FORBIDDEN);
    try {
      return await this.tenantDb.run(async (tx) => {
        const e = await lockEmployee(tx, id);
        if (e.userId) throw conflict("hr.err.EMPLOYEE_ALREADY_HAS_ACCOUNT");
        if (e.status === "TERMINATED") throw conflict("hr.err.EMPLOYEE_ALREADY_TERMINATED");
        const [user] = await tx
          .insert(users)
          .values({
            officeId: p.officeId,
            name: e.name,
            phone: input.phone,
            role: input.role,
            createdBy: p.userId,
          })
          .returning({ id: users.id });
        await tx
          .update(employees)
          .set({ userId: user!.id, updatedBy: p.userId })
          .where(eq(employees.id, id));
        await writeAudit(tx, {
          officeId: p.officeId,
          actorId: p.userId,
          action: "employee.grantAccount",
          entity: "employees",
          entityId: id,
          after: { userId: user!.id, role: input.role },
          ...meta,
        });
        return { id: user!.id };
      });
    } catch (e) {
      if (isUniqueViolation(e, "users_office_phone_key"))
        throw conflict("hr.err.PHONE_ALREADY_IN_USE");
      throw e;
    }
  }

  /**
   * إنهاء الخدمة (full HR level): freezes the end-of-service award. The linked
   * login is switched off in the same transaction, which ends its sessions on
   * the next request (legacy left a terminated employee able to sign in).
   */
  terminate(p: Principal, id: string, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const e = await lockEmployee(tx, id);
      if (e.status === "TERMINATED") throw conflict("hr.err.EMPLOYEE_ALREADY_TERMINATED");
      // Ending one's own service would also lock oneself out.
      if (e.userId === p.userId) throw new ApiException(ErrorCode.FORBIDDEN);
      const at = new Date();
      const eos = endOfServiceAt(e, riyadhCalendarDate(at));
      await tx
        .update(employees)
        .set({
          status: "TERMINATED",
          terminatedAt: at,
          endOfServiceMinor: eos.awardMinor,
          updatedBy: p.userId,
        })
        .where(eq(employees.id, id));
      if (e.userId) {
        await tx
          .update(users)
          .set({ isActive: false, updatedBy: p.userId })
          .where(eq(users.id, e.userId));
      }
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "employee.terminate",
        entity: "employees",
        entityId: id,
        after: { years: eos.years, endOfServiceMinor: eos.awardMinor, accountDisabled: !!e.userId },
        ...meta,
      });
    });
  }

  /** الهيكل التنظيمي: active employees grouped by department (no reporting line in docs/03). */
  orgChart() {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({
          id: employees.id,
          name: employees.name,
          jobTitle: employees.jobTitle,
          department: employees.department,
        })
        .from(employees)
        .where(and(isNull(employees.deletedAt), eq(employees.status, "ACTIVE")))
        .orderBy(asc(employees.name));
      const groups = new Map<
        string | null,
        Array<{ id: string; name: string; jobTitle: string | null }>
      >();
      for (const e of rows) {
        const list = groups.get(e.department) ?? [];
        list.push({ id: e.id, name: e.name, jobTitle: e.jobTitle });
        groups.set(e.department, list);
      }
      return [...groups.entries()]
        .map(([department, list]) => ({ department, employees: list }))
        .sort((a, b) => b.employees.length - a.employees.length);
    });
  }

  /** Nitaqat (docs/06 §6): everyone not terminated counts, on leave and suspended included. */
  saudization() {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({ nationality: employees.nationality })
        .from(employees)
        .where(and(isNull(employees.deletedAt), ne(employees.status, "TERMINATED")));
      const total = rows.length;
      const saudiCount = rows.filter((r) => isSaudi(r.nationality)).length;
      const pct = saudizationPct(saudiCount, total);
      return {
        total,
        saudiCount,
        pct,
        band: nitaqatBand(pct),
        targets: NITAQAT_BANDS.filter((b) => b.minPct > pct).map((b) => ({
          band: b.key,
          minPct: b.minPct,
          saudisNeeded: saudisNeeded(saudiCount, total, b.minPct),
        })),
      };
    });
  }
}
