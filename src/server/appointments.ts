import { AppointmentStatus, AppointmentType, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";

/**
 * Appointments service (docs/05). Standalone office meetings (NOT case-scoped),
 * gated by the المواعيد module. Soft-delete/cancel instead of hard delete
 * (project convention).
 */

const createSchema = z.object({
  contactName: z.string().trim().min(1),
  clientId: z.string().uuid().nullish(),
  leadId: z.string().uuid().nullish(),
  scheduledOn: z.coerce.date(),
  scheduledTime: z.string().nullish(),
  type: z.nativeEnum(AppointmentType).optional(),
});
export type CreateAppointmentInput = z.infer<typeof createSchema>;

export async function listAppointments(session: AppSession) {
  await requireModule(session, PermModule.APPOINTMENTS, "view");
  return prisma.appointment.findMany({
    where: {
      officeId: session.officeId,
      deletedAt: null,
      status: { not: AppointmentStatus.CANCELLED },
    },
    orderBy: { scheduledOn: "asc" },
  });
}

export async function createAppointment(session: AppSession, raw: CreateAppointmentInput) {
  await requireModule(session, PermModule.APPOINTMENTS, "edit");
  const input = createSchema.parse(raw);
  const created = await prisma.appointment.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      contactName: input.contactName,
      clientId: input.clientId ?? null,
      leadId: input.leadId ?? null,
      scheduledOn: input.scheduledOn,
      scheduledTime: input.scheduledTime ?? null,
      type: input.type ?? AppointmentType.FIRST_CONSULTATION,
    },
  });
  await logAudit({ session, action: "appointment.create", resource: "appointments", targetId: created.id });
  return created;
}

export async function cancelAppointment(session: AppSession, id: string) {
  await requireModule(session, PermModule.APPOINTMENTS, "edit");
  const appt = await prisma.appointment.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!appt) throw new PermissionError("scope");
  await prisma.appointment.update({
    where: { id },
    data: { status: AppointmentStatus.CANCELLED },
  });
  await logAudit({ session, action: "appointment.cancel", resource: "appointments", targetId: id });
}
