import { ClientStatus, ClientType, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { normalizeSaudiPhone } from "@/lib/auth/phone";
import { rescanConflictsForName } from "@/lib/conflict/service";

/**
 * Clients service (docs/03). Gated by the العملاء module. Creating or renaming
 * a client re-runs conflict detection (reverse trigger) so an existing case
 * whose opponent equals this client is flagged immediately.
 */

const createSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().nullish(),
  city: z.string().nullish(),
  type: z.nativeEnum(ClientType).optional(),
  status: z.nativeEnum(ClientStatus).optional(),
});
export type CreateClientInput = z.infer<typeof createSchema>;

function normPhoneOrNull(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return normalizeSaudiPhone(phone); // null when invalid — caller may reject
}

export async function listClients(session: AppSession) {
  await requireModule(session, PermModule.CLIENTS, "view");
  return prisma.client.findMany({
    where: { officeId: session.officeId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { cases: { where: { deletedAt: null } } } } },
  });
}

export async function createClient(session: AppSession, raw: CreateClientInput) {
  await requireModule(session, PermModule.CLIENTS, "edit");
  const input = createSchema.parse(raw);
  const created = await prisma.client.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      name: input.name,
      phone: normPhoneOrNull(input.phone),
      city: input.city ?? null,
      type: input.type ?? ClientType.INDIVIDUAL,
      status: input.status ?? ClientStatus.ACTIVE,
    },
  });
  await logAudit({ session, action: "client.create", resource: "clients", targetId: created.id, detail: created.name });
  // Reverse trigger: a new client may complete a conflict on an existing case.
  await rescanConflictsForName(session, created.name);
  return created;
}

export async function updateClient(
  session: AppSession,
  id: string,
  raw: Partial<CreateClientInput>,
) {
  await requireModule(session, PermModule.CLIENTS, "edit");
  const input = createSchema.partial().parse(raw);
  const before = await prisma.client.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!before) throw new PermissionError("scope");

  const updated = await prisma.client.update({
    where: { id },
    data: {
      name: input.name,
      phone: input.phone !== undefined ? normPhoneOrNull(input.phone) : undefined,
      city: input.city,
      type: input.type,
      status: input.status,
    },
  });
  await logAudit({
    session,
    action: "client.update",
    resource: "clients",
    targetId: id,
    detail: input.name && input.name !== before.name ? `renamed from ${before.name}` : undefined,
  });
  if (input.name && input.name !== before.name) {
    await rescanConflictsForName(session, before.name);
    await rescanConflictsForName(session, updated.name);
  }
  return updated;
}
