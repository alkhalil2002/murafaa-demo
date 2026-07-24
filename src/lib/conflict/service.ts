import { ConflictStatus, ConflictType, Prisma, Role, type ConflictFlag } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { t, type MessageKey } from "@/lib/i18n";
import type { AppSession } from "@/lib/auth/types";
import { caseScopeWhere } from "@/lib/permissions/scope";
import {
  detectConflicts,
  highestSeverity,
  normalizeName,
  type ConflictFinding,
} from "./engine";

/** A Prisma client or an interactive-transaction client. */
type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Conflict service (docs/06 §4). Recomputes the four-rule detection for a case
 * office-scoped, reconciles the persisted ConflictFlag rows (preserving manual
 * waivers), refreshes the denormalized Case.conflictSeverity, and audits new
 * detections. The detection itself is the pure engine; this is the I/O shell.
 */
export async function recomputeCaseConflicts(
  session: Pick<AppSession, "officeId" | "userId">,
  caseId: string,
  db: Db = prisma,
): Promise<ConflictFinding[]> {
  const officeId = session.officeId;

  const subject = await db.case.findFirst({
    where: { id: caseId, officeId, deletedAt: null },
    select: { id: true, opposingParty: true, client: { select: { name: true } } },
  });
  if (!subject) return [];

  const [clients, leads, otherCases] = await Promise.all([
    db.client.findMany({
      where: { officeId, deletedAt: null },
      select: { id: true, name: true },
    }),
    db.lead.findMany({
      where: { officeId, deletedAt: null },
      select: { id: true, name: true },
    }),
    db.case.findMany({
      where: { officeId, deletedAt: null, id: { not: caseId } },
      select: {
        id: true,
        title: true,
        opposingParty: true,
        client: { select: { name: true } },
      },
    }),
  ]);

  const findings = detectConflicts(
    { id: subject.id, opposingParty: subject.opposingParty, clientName: subject.client?.name ?? null },
    {
      clients,
      leads,
      otherCases: otherCases.map((o) => ({
        id: o.id,
        title: o.title,
        opposingParty: o.opposingParty,
        clientName: o.client?.name ?? null,
      })),
    },
  );

  await reconcileFlags(session, caseId, findings, db);
  return findings;
}

async function reconcileFlags(
  session: Pick<AppSession, "officeId" | "userId">,
  caseId: string,
  findings: ConflictFinding[],
  db: Db,
): Promise<void> {
  const officeId = session.officeId;
  const existing = await db.conflictFlag.findMany({ where: { officeId, caseId } });
  // Match prior flags by NORMALIZED identity, not raw spelling: a cosmetic name
  // edit that preserves the identity must map to the same prior row so a WAIVED
  // status is preserved rather than silently re-created as ACTIVE.
  const keyOf = (type: string, n: string | null) => `${type}::${normalizeName(n)}`;
  const foundKeys = new Set(findings.map((f) => keyOf(f.conflictType, f.matchedName)));

  for (const f of findings) {
    const prior = existing.find(
      (e) => keyOf(e.conflictType, e.matchedName) === keyOf(f.conflictType, f.matchedName),
    );
    const data = {
      severity: f.severity,
      messageKey: f.messageKey,
      messageParams: (f.messageParams as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      matchedName: f.matchedName,
      matchedClientId: f.matchedClientId ?? null,
      matchedLeadId: f.matchedLeadId ?? null,
      matchedCaseIds: (f.matchedCaseIds as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      detectedAt: new Date(),
    };
    if (prior) {
      // Preserve status (incl. WAIVED); refresh the details + raw name.
      await db.conflictFlag.update({ where: { id: prior.id }, data });
    } else {
      try {
        await db.conflictFlag.create({
          data: { officeId, caseId, conflictType: f.conflictType, status: ConflictStatus.ACTIVE, ...data },
        });
        await logAudit({
          session,
          action: "conflict.detected",
          resource: "cases",
          targetId: caseId,
          detail: `${f.conflictType} (${f.severity}) — ${f.matchedName}`,
        });
      } catch (err) {
        // Concurrent recompute already created this flag (unique key) — ignore.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
      }
    }
  }

  // Remove ACTIVE flags that no longer fire; preserve WAIVED/RESOLVED history.
  const stale = existing.filter(
    (e) => e.status === ConflictStatus.ACTIVE && !foundKeys.has(keyOf(e.conflictType, e.matchedName)),
  );
  if (stale.length) {
    await db.conflictFlag.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  await refreshCaseSeverity(caseId, db);
}

/** Recompute Case.conflictSeverity from ACTIVE flags only. */
async function refreshCaseSeverity(caseId: string, db: Db): Promise<void> {
  const active = await db.conflictFlag.findMany({
    where: { caseId, status: ConflictStatus.ACTIVE },
    select: { severity: true },
  });
  await db.case.update({
    where: { id: caseId },
    data: {
      conflictSeverity: highestSeverity(active as ConflictFinding[]),
      conflictCheckedAt: new Date(),
    },
  });
}

/**
 * Reverse trigger (readers' recommendation): when a client/lead is created or
 * another case's party/client changes, re-scan cases whose opponent or client
 * matches the changed name so an existing conflict isn't silently missed.
 */
export async function rescanConflictsForName(
  session: Pick<AppSession, "officeId" | "userId">,
  name: string,
  db: Db = prisma,
): Promise<void> {
  const officeId = session.officeId;
  const target = normalizeName(name);
  if (!target) return;

  // Match with the SAME Arabic-aware normalization the engine uses — a SQL
  // insensitive-equals would miss alef/ya/ta-marbuta/tashkeel variants and
  // silently skip a real conflict. Filter office cases in memory.
  const all = await db.case.findMany({
    where: { officeId, deletedAt: null },
    select: { id: true, opposingParty: true, client: { select: { name: true } } },
  });
  const affected = all.filter(
    (c) =>
      normalizeName(c.opposingParty) === target ||
      normalizeName(c.client?.name ?? null) === target,
  );
  for (const c of affected) {
    await recomputeCaseConflicts(session, c.id, db);
  }
}

/**
 * Render a conflict flag's message for display, honoring the viewer's case
 * row-scope (readers' scope-leak caution): the "other case" rules embed titles
 * of other cases, so a restricted-scope viewer gets a generic count instead of
 * titles they aren't allowed to see.
 */
export async function renderConflictMessage(
  session: AppSession,
  flag: Pick<ConflictFlag, "conflictType" | "messageKey" | "messageParams" | "matchedCaseIds">,
): Promise<string> {
  const params = (flag.messageParams ?? {}) as Record<string, string>;
  const otherCaseRule =
    flag.conflictType === ConflictType.OPPONENT_IS_OUR_CLIENT_OTHER_CASE ||
    flag.conflictType === ConflictType.OUR_CLIENT_IS_OPPONENT_OTHER_CASE;

  if (otherCaseRule && Array.isArray(flag.matchedCaseIds)) {
    const matchedIds = (flag.matchedCaseIds as string[]).filter(Boolean);
    const scope = await caseScopeWhere(session);
    const visible = await prisma.case.findMany({
      where: { ...scope, id: { in: matchedIds } },
      select: { id: true },
    });
    if (visible.length < matchedIds.length) {
      // Hide titles the viewer may not see; show a count instead.
      const genericKey: MessageKey =
        flag.conflictType === ConflictType.OPPONENT_IS_OUR_CLIENT_OTHER_CASE
          ? "conflict.opponentIsOurClientOtherCaseGeneric"
          : "conflict.ourClientIsOpponentOtherCaseGeneric";
      return t(genericKey, {
        opponent: params.opponent ?? "",
        client: params.client ?? "",
        count: matchedIds.length,
      });
    }
  }
  return t(flag.messageKey as MessageKey, params);
}

/** Partner-only: document consent and clear a conflict (docs/06 §4 banner footer). */
export async function waiveConflict(
  session: AppSession,
  flagId: string,
  note: string,
): Promise<void> {
  if (session.role !== Role.PARTNER) {
    throw new Error("PERM_DENIED: only a partner may waive a conflict");
  }
  const flag = await prisma.conflictFlag.findFirst({
    where: { id: flagId, officeId: session.officeId },
  });
  if (!flag) throw new Error("NOT_FOUND");

  await prisma.$transaction(async (tx) => {
    await tx.conflictFlag.update({
      where: { id: flagId },
      data: {
        status: ConflictStatus.WAIVED,
        waiverNote: note,
        waivedById: session.userId,
        waivedAt: new Date(),
      },
    });
    await refreshCaseSeverity(flag.caseId, tx);
  });

  await logAudit({
    session,
    action: "conflict.waived",
    resource: "cases",
    targetId: flag.caseId,
    detail: `waived ${flag.conflictType} — ${note}`,
  });
}
