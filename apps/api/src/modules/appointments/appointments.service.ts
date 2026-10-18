import { Injectable } from "@nestjs/common";
import { type createAppointmentBody, ErrorCode } from "@murafaa/contracts";
import { appointments, clients, leads, type Tx } from "@murafaa/database";
import { and, asc, count, eq, isNull, ne } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";

type Meta = { ip: string; requestId: string };

/**
 * المواعيد (legacy server/appointments.ts): office meetings, not tied to a
 * case. Cancel is a status change, never a delete.
 */
@Injectable()
export class AppointmentsService {
  constructor(private readonly tenantDb: TenantDb) {}

  list() {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select()
        .from(appointments)
        .where(and(isNull(appointments.deletedAt), ne(appointments.status, "CANCELLED")))
        .orderBy(asc(appointments.scheduledOn));
      return rows.map((a) => ({
        id: a.id,
        contactName: a.contactName,
        clientId: a.clientId,
        leadId: a.leadId,
        scheduledOn: a.scheduledOn.toISOString(),
        scheduledTime: a.scheduledTime,
        type: a.type,
        status: a.status,
      }));
    });
  }

  create(p: Principal, input: z.infer<typeof createAppointmentBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      // RLS hides other offices' rows, so a foreign id is simply not found.
      if (input.clientId) {
        const [c] = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.id, input.clientId));
        if (!c)
          throw new ApiException(ErrorCode.VALIDATION_FAILED, [
            { path: "clientId", message: "errors.NOT_FOUND" },
          ]);
      }
      if (input.leadId) {
        const [l] = await tx.select({ id: leads.id }).from(leads).where(eq(leads.id, input.leadId));
        if (!l)
          throw new ApiException(ErrorCode.VALIDATION_FAILED, [
            { path: "leadId", message: "errors.NOT_FOUND" },
          ]);
      }
      const [created] = await tx
        .insert(appointments)
        .values({
          officeId: p.officeId,
          contactName: input.contactName,
          clientId: input.clientId ?? null,
          leadId: input.leadId ?? null,
          scheduledOn: input.scheduledOn,
          scheduledTime: input.scheduledTime ?? null,
          type: input.type,
          createdBy: p.userId,
        })
        .returning({ id: appointments.id });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "appointment.create",
        entity: "appointments",
        entityId: created!.id,
        ...meta,
      });
      return { id: created!.id };
    });
  }

  cancel(p: Principal, id: string, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [done] = await tx
        .update(appointments)
        .set({ status: "CANCELLED", updatedBy: p.userId })
        .where(and(eq(appointments.id, id), isNull(appointments.deletedAt)))
        .returning({ id: appointments.id });
      if (!done) throw new ApiException(ErrorCode.NOT_FOUND);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "appointment.cancel",
        entity: "appointments",
        entityId: id,
        ...meta,
      });
    });
  }

  /** Journey counts: every appointment ever booked, and the follow-ups among them (legacy). */
  async stats(tx: Tx) {
    const [all] = await tx
      .select({ n: count() })
      .from(appointments)
      .where(isNull(appointments.deletedAt));
    const [followUps] = await tx
      .select({ n: count() })
      .from(appointments)
      .where(and(isNull(appointments.deletedAt), eq(appointments.type, "FOLLOW_UP")));
    return { total: all?.n ?? 0, followUps: followUps?.n ?? 0 };
  }
}
