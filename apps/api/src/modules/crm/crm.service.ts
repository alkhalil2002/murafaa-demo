import { Injectable } from "@nestjs/common";
import { ErrorCode } from "@murafaa/contracts";
import type { z } from "zod";
import type {
  createClientBody,
  createLeadBody,
  updateClientBody,
  updateLeadBody,
} from "@murafaa/contracts";
import { clients, leads } from "@murafaa/database";
import { leadConversionPct, LEAD_STAGES, stepStage } from "@murafaa/rules";
import { and, count, desc, eq, isNotNull, isNull, sum } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import { isUniqueViolation } from "../../common/db/pg-errors.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";

type Meta = { ip: string; requestId: string };

const phoneTaken = () =>
  new ApiException(ErrorCode.CONFLICT, undefined, "errors.CLIENT_PHONE_TAKEN");

/**
 * Clients and the leads pipeline (legacy server/clients.ts, server/leads.ts),
 * gated by the العملاء module. Converting a lead and re-running conflict
 * detection when a name changes arrive with the cases module.
 */
@Injectable()
export class CrmService {
  constructor(private readonly tenantDb: TenantDb) {}

  async listClients() {
    const rows = await this.tenantDb.run((tx) =>
      tx.select().from(clients).where(isNull(clients.deletedAt)).orderBy(desc(clients.createdAt)),
    );
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      city: c.city,
      type: c.type,
      status: c.status,
      casesCount: 0,
    }));
  }

  async createClient(p: Principal, input: z.infer<typeof createClientBody>, meta: Meta) {
    try {
      return await this.tenantDb.run(async (tx) => {
        const [created] = await tx
          .insert(clients)
          .values({ officeId: p.officeId, ...input, createdBy: p.userId })
          .returning();
        await writeAudit(tx, {
          officeId: p.officeId,
          actorId: p.userId,
          action: "client.create",
          entity: "clients",
          entityId: created!.id,
          ...meta,
        });
        return created!;
      });
    } catch (e) {
      if (isUniqueViolation(e, "clients_office_phone_key")) throw phoneTaken();
      throw e;
    }
  }

  async updateClient(
    p: Principal,
    id: string,
    input: z.infer<typeof updateClientBody>,
    meta: Meta,
  ) {
    try {
      await this.tenantDb.run(async (tx) => {
        const [before] = await tx
          .select({ name: clients.name })
          .from(clients)
          .where(and(eq(clients.id, id), isNull(clients.deletedAt)));
        if (!before) throw new ApiException(ErrorCode.NOT_FOUND);
        await tx
          .update(clients)
          .set({ ...input, updatedBy: p.userId })
          .where(eq(clients.id, id));
        await writeAudit(tx, {
          officeId: p.officeId,
          actorId: p.userId,
          action: "client.update",
          entity: "clients",
          entityId: id,
          after:
            input.name && input.name !== before.name ? { renamedFrom: before.name } : undefined,
          ...meta,
        });
      });
    } catch (e) {
      if (isUniqueViolation(e, "clients_office_phone_key")) throw phoneTaken();
      throw e;
    }
  }

  /** Active pipeline: not deleted and not converted. */
  listLeads() {
    return this.tenantDb.run((tx) =>
      tx
        .select({
          id: leads.id,
          name: leads.name,
          type: leads.type,
          source: leads.source,
          stage: leads.stage,
          expectedValue: leads.expectedValue,
          nextAction: leads.nextAction,
          phone: leads.phone,
        })
        .from(leads)
        .where(and(isNull(leads.deletedAt), isNull(leads.convertedClientId)))
        .orderBy(desc(leads.createdAt)),
    );
  }

  /** Active count and value of the pipeline; conversion rate over every lead ever created (legacy). */
  kpis() {
    return this.tenantDb.run(async (tx) => {
      const [active] = await tx
        .select({ n: count(), value: sum(leads.expectedValue) })
        .from(leads)
        .where(and(isNull(leads.deletedAt), isNull(leads.convertedClientId)));
      const [ever] = await tx.select({ n: count() }).from(leads);
      const [converted] = await tx
        .select({ n: count() })
        .from(leads)
        .where(isNotNull(leads.convertedClientId));
      return {
        activeCount: active?.n ?? 0,
        pipelineValue: Number(active?.value ?? 0),
        conversionRatePct: leadConversionPct(ever?.n ?? 0, converted?.n ?? 0),
      };
    });
  }

  createLead(p: Principal, input: z.infer<typeof createLeadBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [created] = await tx
        .insert(leads)
        .values({ officeId: p.officeId, ...input, createdBy: p.userId })
        .returning({ id: leads.id });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "lead.create",
        entity: "leads",
        entityId: created!.id,
        ...meta,
      });
    });
  }

  updateLead(p: Principal, id: string, input: z.infer<typeof updateLeadBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [lead] = await this.activeLead(tx, id);
      if (!lead) throw new ApiException(ErrorCode.NOT_FOUND);
      await tx
        .update(leads)
        .set({
          ...input,
          expectedValue: input.expectedValue ?? lead.expectedValue,
          updatedBy: p.userId,
        })
        .where(eq(leads.id, id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "lead.update",
        entity: "leads",
        entityId: id,
        ...meta,
      });
    });
  }

  /** One bounded step through the pipeline (docs BR-CRM-MOVE). */
  moveLead(p: Principal, id: string, direction: 1 | -1, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [lead] = await this.activeLead(tx, id);
      if (!lead) throw new ApiException(ErrorCode.NOT_FOUND);
      const next = stepStage(LEAD_STAGES, lead.stage, direction);
      if (next === lead.stage) return;
      await tx.update(leads).set({ stage: next, updatedBy: p.userId }).where(eq(leads.id, id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "lead.move",
        entity: "leads",
        entityId: id,
        after: { to: next },
        ...meta,
      });
    });
  }

  /** Soft delete into the recycle bin. */
  deleteLead(p: Principal, id: string, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [lead] = await this.activeLead(tx, id);
      if (!lead) throw new ApiException(ErrorCode.NOT_FOUND);
      await tx
        .update(leads)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(eq(leads.id, id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "lead.delete",
        entity: "leads",
        entityId: id,
        ...meta,
      });
    });
  }

  private activeLead(tx: Parameters<Parameters<TenantDb["run"]>[0]>[0], id: string) {
    return tx
      .select({ stage: leads.stage, expectedValue: leads.expectedValue })
      .from(leads)
      .where(and(eq(leads.id, id), isNull(leads.deletedAt), isNull(leads.convertedClientId)));
  }
}
