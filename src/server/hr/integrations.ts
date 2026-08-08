import { IntegrationKey, PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";

/**
 * التكاملات (docs/03 `INTEGRATIONS`) — docs itself frames this as "محاكاة
 * بصرية، بلا ربط API فعلي" (a visual simulation, no real API connection).
 * This is a real per-office connect/disconnect/sync-now toggle honestly
 * presented as simulated status — never a stand-in for an actual GOSI/Qiwa/
 * Mudad/ZATCA/Absher/Muqeem integration, which docs/02 §7 defers to later.
 */

export const ALL_INTEGRATION_KEYS: IntegrationKey[] = [
  IntegrationKey.GOSI,
  IntegrationKey.QIWA,
  IntegrationKey.MUDAD,
  IntegrationKey.ZATCA,
  IntegrationKey.ABSHER,
  IntegrationKey.MUQEEM,
];

export type IntegrationRow = {
  key: IntegrationKey;
  connected: boolean;
  lastSyncedAt: Date | null;
};

export async function listIntegrations(session: AppSession): Promise<IntegrationRow[]> {
  await requireModule(session, PermModule.HR, "view");
  const rows = await prisma.integrationConnection.findMany({ where: { officeId: session.officeId } });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return ALL_INTEGRATION_KEYS.map((key) => {
    const r = byKey.get(key);
    return { key, connected: r?.connected ?? false, lastSyncedAt: r?.lastSyncedAt ?? null };
  });
}

export async function connectIntegration(session: AppSession, key: IntegrationKey): Promise<void> {
  await requireModule(session, PermModule.HR, "edit");
  await prisma.integrationConnection.upsert({
    where: { officeId_key: { officeId: session.officeId, key } },
    create: { officeId: session.officeId, key, connected: true, lastSyncedAt: new Date() },
    update: { connected: true, lastSyncedAt: new Date() },
  });
  await logAudit({ session, action: "integration.connect", resource: "hr", detail: key });
}

export async function disconnectIntegration(session: AppSession, key: IntegrationKey): Promise<void> {
  await requireModule(session, PermModule.HR, "edit");
  await prisma.integrationConnection.upsert({
    where: { officeId_key: { officeId: session.officeId, key } },
    create: { officeId: session.officeId, key, connected: false },
    update: { connected: false },
  });
  await logAudit({ session, action: "integration.disconnect", resource: "hr", detail: key });
}

export async function syncIntegrationNow(session: AppSession, key: IntegrationKey): Promise<void> {
  await requireModule(session, PermModule.HR, "edit");
  const existing = await prisma.integrationConnection.findUnique({
    where: { officeId_key: { officeId: session.officeId, key } },
  });
  if (!existing?.connected) throw new Error("INTEGRATION_NOT_CONNECTED");
  await prisma.integrationConnection.update({
    where: { officeId_key: { officeId: session.officeId, key } },
    data: { lastSyncedAt: new Date() },
  });
  await logAudit({ session, action: "integration.sync", resource: "hr", detail: key });
}
