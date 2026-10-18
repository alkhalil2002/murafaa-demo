import { Injectable } from "@nestjs/common";
import { ErrorCode } from "@murafaa/contracts";
import type { z } from "zod";
import type {
  createClientBody,
  createLeadBody,
  updateClientBody,
  updateLeadBody,
} from "@murafaa/contracts";
import { clients, leads, type Tx } from "@murafaa/database";
import { t } from "@murafaa/i18n";
import { leadConversionPct, LEAD_STAGES, type LeadStage, NAJIZ, stepStage } from "@murafaa/rules";
import { and, count, desc, eq, ilike, isNotNull, isNull, or, sum } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import { containsPattern } from "../../common/db/like.js";
import { isUniqueViolation } from "../../common/db/pg-errors.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { CasesService } from "../cases/cases.service.js";
import { ConflictsService } from "../cases/conflicts.service.js";

type Meta = { ip: string; requestId: string };

const phoneTaken = () =>
  new ApiException(ErrorCode.CONFLICT, undefined, "errors.CLIENT_PHONE_TAKEN");

/**
 * Clients and the leads pipeline (legacy server/clients.ts, server/leads.ts),
 * gated by the العملاء module. A new or renamed client/lead re-runs conflict
 * detection on existing cases (reverse trigger).
 */
@Injectable()
export class CrmService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly cases: CasesService,
    private readonly conflicts: ConflictsService,
  ) {}

  async listClients() {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select()
        .from(clients)
        .where(isNull(clients.deletedAt))
        .orderBy(desc(clients.createdAt));
      const counts = await this.cases.activeCaseCountsByClient(tx);
      return rows.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        city: c.city,
        type: c.type,
        status: c.status,
        casesCount: counts.get(c.id) ?? 0,
      }));
    });
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
        await this.conflicts.rescanForName(tx, p.officeId, created!.name, p.userId);
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
        const renamed = Boolean(input.name && input.name !== before.name);
        await writeAudit(tx, {
          officeId: p.officeId,
          actorId: p.userId,
          action: "client.update",
          entity: "clients",
          entityId: id,
          after: renamed ? { renamedFrom: before.name } : undefined,
          ...meta,
        });
        if (renamed) {
          await this.conflicts.rescanForName(tx, p.officeId, before.name, p.userId);
          await this.conflicts.rescanForName(tx, p.officeId, input.name, p.userId);
        }
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
      await this.conflicts.rescanForName(tx, p.officeId, input.name, p.userId);
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
      if (input.name !== lead.name) {
        await this.conflicts.rescanForName(tx, p.officeId, lead.name, p.userId);
        await this.conflicts.rescanForName(tx, p.officeId, input.name, p.userId);
      }
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

  /**
   * Convert a CONTRACTED lead into a client and a new case, atomically
   * (docs BR-CRM-CONVERT). Claiming the lead first makes a double submit
   * create exactly one pair. The phone moves to the client unless another
   * client already has it. Unlike legacy, the converter is assigned to the
   * new case, so an ASSIGNED-scope user can see what they created.
   */
  convertLead(p: Principal, id: string, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [claimed] = await tx
        .update(leads)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(
          and(
            eq(leads.id, id),
            eq(leads.stage, "CONTRACTED"),
            isNull(leads.convertedClientId),
            isNull(leads.deletedAt),
          ),
        )
        .returning();
      if (!claimed) {
        const [lead] = await tx
          .select({ converted: leads.convertedClientId })
          .from(leads)
          .where(eq(leads.id, id));
        if (!lead) throw new ApiException(ErrorCode.NOT_FOUND);
        throw new ApiException(
          ErrorCode.CONFLICT,
          undefined,
          lead.converted ? "errors.LEAD_ALREADY_CONVERTED" : "errors.LEAD_NOT_CONTRACTED",
        );
      }

      let phone = claimed.phone;
      if (phone) {
        const [taken] = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.phone, phone));
        if (taken) phone = null;
      }
      const [client] = await tx
        .insert(clients)
        .values({
          officeId: p.officeId,
          name: claimed.name,
          type: claimed.type,
          status: "ACTIVE",
          phone,
          createdBy: p.userId,
        })
        .returning({ id: clients.id, name: clients.name });

      // Najiz defaults: first main class → first sub class → first case type (legacy parity).
      const mainClass = Object.keys(NAJIZ)[0]!;
      const subs = NAJIZ[mainClass as keyof typeof NAJIZ] as Record<string, readonly string[]>;
      const subClass = Object.keys(subs)[0]!;
      const { id: caseId } = await this.cases.insertCase(
        tx,
        p,
        {
          number: "—",
          title: t("case.autoTitleFromLead", { name: claimed.name }),
          clientRole: "PLAINTIFF",
          clientId: client!.id,
          opposingParty: null,
          entity: null,
          najizMainClass: mainClass,
          najizSubClass: subClass,
          najizCaseType: subs[subClass]![0]!,
          city: null,
          stage: "FIRST_INSTANCE",
          status: "ACTIVE",
        },
        [p.userId],
        meta,
        { messageKey: "event.leadConverted", params: { name: claimed.name } },
      );

      await tx
        .update(leads)
        .set({ convertedClientId: client!.id, convertedCaseId: caseId })
        .where(eq(leads.id, id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "lead.convert",
        entity: "leads",
        entityId: id,
        after: { clientId: client!.id, caseId },
        ...meta,
      });
      await this.conflicts.rescanForName(tx, p.officeId, client!.name, p.userId);
      return { clientId: client!.id, caseId };
    });
  }

  private activeLead(tx: Tx, id: string) {
    return tx
      .select({ name: leads.name, stage: leads.stage, expectedValue: leads.expectedValue })
      .from(leads)
      .where(and(eq(leads.id, id), isNull(leads.deletedAt), isNull(leads.convertedClientId)));
  }

  // ── Read models for the office overview ──

  /**
   * Client count and leads per stage. A converted lead is soft-deleted when it
   * becomes a client, but still counts as CONTRACTED in the journey funnel.
   */
  async stats(tx: Tx) {
    const [c] = await tx.select({ n: count() }).from(clients).where(isNull(clients.deletedAt));
    const rows = await tx
      .select({ stage: leads.stage, n: count() })
      .from(leads)
      .where(or(isNull(leads.deletedAt), isNotNull(leads.convertedClientId)))
      .groupBy(leads.stage);
    const leadsByStage = Object.fromEntries(LEAD_STAGES.map((st) => [st, 0])) as Record<
      LeadStage,
      number
    >;
    for (const r of rows) leadsByStage[r.stage] = r.n;
    return { clients: c?.n ?? 0, leadsByStage };
  }

  /** Clients and active leads whose name or phone contains `q`. */
  async search(tx: Tx, q: string, take: number) {
    const pat = containsPattern(q);
    const [found, pipeline] = await Promise.all([
      tx
        .select({ id: clients.id, name: clients.name, phone: clients.phone })
        .from(clients)
        .where(
          and(isNull(clients.deletedAt), or(ilike(clients.name, pat), ilike(clients.phone, pat))),
        )
        .limit(take),
      tx
        .select({ id: leads.id, name: leads.name, phone: leads.phone })
        .from(leads)
        .where(
          and(
            isNull(leads.deletedAt),
            isNull(leads.convertedClientId),
            or(ilike(leads.name, pat), ilike(leads.phone, pat)),
          ),
        )
        .limit(take),
    ]);
    return { clients: found, leads: pipeline };
  }
}
