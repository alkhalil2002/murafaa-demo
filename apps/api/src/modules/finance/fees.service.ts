import { Injectable } from "@nestjs/common";
import { ErrorCode, type feeAgreementBody, type timeEntryBody } from "@murafaa/contracts";
import {
  caseFeeAgreements,
  cases,
  invoices,
  payments,
  timeEntries,
  type Tx,
  users,
} from "@murafaa/database";
import { t } from "@murafaa/i18n";
import { feeNet, paidOf, riyadhCalendarDate, timeEntryValue } from "@murafaa/rules";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { assertOfficeUser } from "../cases/case-access.service.js";
import { InvoicesService } from "./invoices.service.js";

type Meta = { ip: string; requestId: string };
const conflict = (key: string) => new ApiException(ErrorCode.CONFLICT, undefined, key);

/**
 * Case fee agreements, time entries and the invoices made from them (docs/06
 * §3; legacy server/fees.ts and the time half of expenses.ts). Fee data is
 * gated by FINANCE even though it is shown on the case (cross-module rule).
 */
@Injectable()
export class FeesService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly invoices: InvoicesService,
  ) {}

  private async liveCase(tx: Tx, caseId: string) {
    const [c] = await tx
      .select({ id: cases.id, clientId: cases.clientId, title: cases.title })
      .from(cases)
      .where(and(eq(cases.id, caseId), isNull(cases.deletedAt)));
    if (!c) throw new ApiException(ErrorCode.NOT_FOUND);
    return c;
  }

  private async agreementOf(tx: Tx, caseId: string) {
    const [a] = await tx
      .select()
      .from(caseFeeAgreements)
      .where(and(eq(caseFeeAgreements.caseId, caseId), isNull(caseFeeAgreements.deletedAt)));
    return a;
  }

  private unbilled(tx: Tx, caseId: string) {
    return tx
      .select({
        id: timeEntries.id,
        minutes: timeEntries.minutes,
        hourlyRate: timeEntries.hourlyRate,
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.caseId, caseId),
          eq(timeEntries.billable, true),
          eq(timeEntries.invoiced, false),
          isNull(timeEntries.deletedAt),
        ),
      );
  }

  /** The agreement, what invoicing it now would bill, the agreed total and what was collected on the case. */
  view(caseId: string) {
    return this.tenantDb.run(async (tx) => {
      await this.liveCase(tx, caseId);
      const a = await this.agreementOf(tx, caseId);
      const fee = a
        ? {
            type: a.type,
            feeValueMinor: a.feeValue,
            percentageBps: a.percentageBps,
            awardedMinor: a.awarded,
          }
        : null;
      const time = fee?.type === "HOURLY" ? await this.unbilled(tx, caseId) : [];
      const caseInvoices = await tx
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.caseId, caseId), isNull(invoices.deletedAt)));
      const collected = caseInvoices.length
        ? paidOf(
            await tx
              .select({ amount: payments.amount })
              .from(payments)
              .where(
                and(
                  inArray(
                    payments.invoiceId,
                    caseInvoices.map((i) => i.id),
                  ),
                  isNull(payments.deletedAt),
                ),
              ),
          )
        : 0;
      return {
        agreement: a
          ? {
              type: a.type,
              feeValue: a.feeValue,
              percentageBps: a.percentageBps,
              awarded: a.awarded,
            }
          : null,
        previewNet: fee ? feeNet(fee, time) : 0,
        agreed: fee && fee.type !== "HOURLY" ? feeNet(fee, []) : null,
        collected,
      };
    });
  }

  save(p: Principal, caseId: string, input: z.infer<typeof feeAgreementBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      await this.liveCase(tx, caseId);
      const values = {
        type: input.type,
        feeValue: input.feeValue ?? null,
        percentageBps: input.percentageBps ?? null,
        awarded: input.awarded ?? null,
        updatedBy: p.userId,
      };
      const existing = await this.agreementOf(tx, caseId);
      if (existing)
        await tx.update(caseFeeAgreements).set(values).where(eq(caseFeeAgreements.id, existing.id));
      else
        await tx
          .insert(caseFeeAgreements)
          .values({ officeId: p.officeId, caseId, ...values, createdBy: p.userId });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "fee.save",
        entity: "finance",
        entityId: caseId,
        after: { type: input.type },
        ...meta,
      });
    });
  }

  /**
   * Invoice the case's fee agreement (docs FEE-INVOICE-*). Hourly fees bill
   * the unbilled time, which is claimed by a conditional update in the same
   * transaction, so a double submit cannot bill the same hours twice.
   */
  invoiceFee(p: Principal, caseId: string, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const kase = await this.liveCase(tx, caseId);
      if (!kase.clientId) throw conflict("errors.FEE_INVOICE_NO_CLIENT");
      const a = await this.agreementOf(tx, caseId);
      if (!a) throw conflict("errors.FEE_AGREEMENT_MISSING");
      const claimed =
        a.type === "HOURLY"
          ? await tx
              .update(timeEntries)
              .set({ invoiced: true, updatedBy: p.userId })
              .where(
                and(
                  eq(timeEntries.caseId, caseId),
                  eq(timeEntries.billable, true),
                  eq(timeEntries.invoiced, false),
                  isNull(timeEntries.deletedAt),
                ),
              )
              .returning({
                id: timeEntries.id,
                minutes: timeEntries.minutes,
                hourlyRate: timeEntries.hourlyRate,
              })
          : [];
      const net = feeNet(
        {
          type: a.type,
          feeValueMinor: a.feeValue,
          percentageBps: a.percentageBps,
          awardedMinor: a.awarded,
        },
        claimed,
      );
      if (net <= 0) throw conflict("errors.FEE_NET_NONPOSITIVE");
      const basis = t(`invoice.basis.${a.type}`);
      const inv = await this.invoices.createInTx(tx, p, {
        clientId: kase.clientId,
        caseId,
        issueDate: riyadhCalendarDate(),
        items: [{ description: basis, quantity: 1, unitPrice: net }],
        basis,
        origin: "FEE_AGREEMENT",
      });
      if (claimed.length) {
        await tx
          .update(timeEntries)
          .set({ invoiceId: inv.id })
          .where(
            inArray(
              timeEntries.id,
              claimed.map((c) => c.id),
            ),
          );
      }
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "fee.invoice",
        entity: "finance",
        entityId: inv.id,
        after: { number: inv.number, caseId },
        ...meta,
      });
      return inv;
    });
  }

  // ── Time entries ──

  listTime(caseId?: string) {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({ te: timeEntries, caseTitle: cases.title, lawyerName: users.name })
        .from(timeEntries)
        .innerJoin(cases, eq(cases.id, timeEntries.caseId))
        .innerJoin(users, eq(users.id, timeEntries.lawyerId))
        .where(
          and(isNull(timeEntries.deletedAt), caseId ? eq(timeEntries.caseId, caseId) : undefined),
        )
        .orderBy(desc(timeEntries.workDate), desc(timeEntries.createdAt));
      return rows.map(({ te, caseTitle, lawyerName }) => ({
        id: te.id,
        caseId: te.caseId,
        caseTitle,
        lawyerId: te.lawyerId,
        lawyerName,
        description: te.description,
        minutes: te.minutes,
        hourlyRate: te.hourlyRate,
        value: timeEntryValue(te.minutes, te.hourlyRate),
        workDate: te.workDate.toISOString().slice(0, 10),
        billable: te.billable,
        invoiced: te.invoiced,
      }));
    });
  }

  addTime(p: Principal, input: z.infer<typeof timeEntryBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      await this.liveCase(tx, input.caseId);
      await assertOfficeUser(tx, input.lawyerId, "lawyerId");
      const [te] = await tx
        .insert(timeEntries)
        .values({
          officeId: p.officeId,
          caseId: input.caseId,
          lawyerId: input.lawyerId,
          description: input.description,
          minutes: input.minutes,
          hourlyRate: input.hourlyRate,
          workDate: input.workDate ?? riyadhCalendarDate(),
          billable: input.billable,
          createdBy: p.userId,
        })
        .returning({ id: timeEntries.id });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "time.create",
        entity: "finance",
        entityId: te!.id,
        ...meta,
      });
      return { id: te!.id };
    });
  }

  /** Invoice one time entry on its own; the entry is claimed first so it is billed once. */
  invoiceTime(p: Principal, entryId: string, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [te] = await tx
        .update(timeEntries)
        .set({ invoiced: true, updatedBy: p.userId })
        .where(
          and(
            eq(timeEntries.id, entryId),
            eq(timeEntries.billable, true),
            eq(timeEntries.invoiced, false),
            isNull(timeEntries.deletedAt),
          ),
        )
        .returning();
      if (!te) throw conflict("errors.TIME_NOT_BILLABLE");
      const kase = await this.liveCase(tx, te.caseId);
      if (!kase.clientId) throw conflict("errors.FEE_INVOICE_NO_CLIENT");
      const inv = await this.invoices.createInTx(tx, p, {
        clientId: kase.clientId,
        caseId: te.caseId,
        issueDate: riyadhCalendarDate(),
        items: [
          {
            description: te.description ?? t("invoice.basis.timeEntry", { case: kase.title }),
            quantity: 1,
            unitPrice: timeEntryValue(te.minutes, te.hourlyRate),
          },
        ],
        basis: t("invoice.basis.HOURLY"),
        origin: "TIME_ENTRY",
        fromTimeEntryId: te.id,
      });
      await tx.update(timeEntries).set({ invoiceId: inv.id }).where(eq(timeEntries.id, te.id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "time.invoice",
        entity: "finance",
        entityId: te.id,
        after: { number: inv.number },
        ...meta,
      });
      return inv;
    });
  }
}
