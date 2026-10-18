import { Injectable } from "@nestjs/common";
import type { OfficePolicy } from "@murafaa/auth";
import { clients, conflictFlags, cases, leads, type Tx } from "@murafaa/database";
import {
  type ConflictFinding,
  ConflictType,
  detectConflicts,
  highestSeverity,
  normalizeName,
} from "@murafaa/rules";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { caseVisibility } from "./case-scope.js";

type Flag = typeof conflictFlags.$inferSelect;

/** Same identity as the engine: normalized name per conflict type. */
const keyOf = (type: string, name: string | null) => `${type}::${normalizeName(name)}`;

/**
 * Conflict-of-interest shell around the pure four-rule engine (docs/06 §4,
 * legacy lib/conflict/service.ts). Runs inside the caller's tenant
 * transaction. Differences from legacy: a flag that stops firing becomes
 * RESOLVED instead of being deleted (history kept, no DELETE grant), and
 * comes back ACTIVE if it fires again; a WAIVED flag stays waived.
 */
@Injectable()
export class ConflictsService {
  /** Re-run detection for one case and reconcile its flags. */
  async recompute(
    tx: Tx,
    officeId: string,
    caseId: string,
    actorId: string | null,
  ): Promise<ConflictFinding[]> {
    const [subject] = await tx
      .select({ id: cases.id, opposingParty: cases.opposingParty, clientName: clients.name })
      .from(cases)
      .leftJoin(clients, eq(clients.id, cases.clientId))
      .where(and(eq(cases.id, caseId), isNull(cases.deletedAt)));
    if (!subject) return [];

    const candidateClients = await tx
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(isNull(clients.deletedAt));
    // Converted leads are archived (deleted_at set), so only the live pipeline counts.
    const candidateLeads = await tx
      .select({ id: leads.id, name: leads.name })
      .from(leads)
      .where(isNull(leads.deletedAt));
    const otherCases = await tx
      .select({
        id: cases.id,
        title: cases.title,
        opposingParty: cases.opposingParty,
        clientName: clients.name,
      })
      .from(cases)
      .leftJoin(clients, eq(clients.id, cases.clientId))
      .where(and(isNull(cases.deletedAt), ne(cases.id, caseId)));

    const findings = detectConflicts(
      { id: subject.id, opposingParty: subject.opposingParty, clientName: subject.clientName },
      { clients: candidateClients, leads: candidateLeads, otherCases },
    );
    await this.reconcile(tx, officeId, caseId, findings, actorId);
    return findings;
  }

  private async reconcile(
    tx: Tx,
    officeId: string,
    caseId: string,
    findings: ConflictFinding[],
    actorId: string | null,
  ) {
    const existing = await tx.select().from(conflictFlags).where(eq(conflictFlags.caseId, caseId));
    const found = new Set(findings.map((f) => keyOf(f.conflictType, f.matchedName)));

    for (const f of findings) {
      const prior = existing.find(
        (e) => keyOf(e.conflictType, e.matchedName) === keyOf(f.conflictType, f.matchedName),
      );
      const details = {
        severity: f.severity,
        messageKey: f.messageKey,
        messageParams: f.messageParams,
        matchedName: f.matchedName,
        matchedClientId: f.matchedClientId ?? null,
        matchedLeadId: f.matchedLeadId ?? null,
        matchedCaseIds: f.matchedCaseIds ?? null,
        detectedAt: new Date(),
        updatedBy: actorId,
      };
      if (prior) {
        await tx
          .update(conflictFlags)
          .set({
            ...details,
            ...(prior.status === "RESOLVED" ? { status: "ACTIVE" as const } : {}),
          })
          .where(eq(conflictFlags.id, prior.id));
      } else {
        const inserted = await tx
          .insert(conflictFlags)
          .values({
            officeId,
            caseId,
            conflictType: f.conflictType,
            status: "ACTIVE",
            createdBy: actorId,
            ...details,
          })
          .onConflictDoNothing()
          .returning({ id: conflictFlags.id });
        if (inserted.length) {
          await writeAudit(tx, {
            officeId,
            actorId,
            action: "conflict.detected",
            entity: "cases",
            entityId: caseId,
            after: { type: f.conflictType, severity: f.severity },
          });
        }
      }
    }

    const stale = existing.filter(
      (e) => e.status === "ACTIVE" && !found.has(keyOf(e.conflictType, e.matchedName)),
    );
    if (stale.length) {
      await tx
        .update(conflictFlags)
        .set({ status: "RESOLVED", updatedBy: actorId })
        .where(
          inArray(
            conflictFlags.id,
            stale.map((s) => s.id),
          ),
        );
    }
    await this.refreshSeverity(tx, caseId);
  }

  /** Case.conflictSeverity = highest ACTIVE flag severity. */
  async refreshSeverity(tx: Tx, caseId: string) {
    const active = await tx
      .select({ severity: conflictFlags.severity })
      .from(conflictFlags)
      .where(and(eq(conflictFlags.caseId, caseId), eq(conflictFlags.status, "ACTIVE")));
    await tx
      .update(cases)
      .set({
        conflictSeverity: highestSeverity(
          active as Array<Pick<ConflictFinding, "severity">> as ConflictFinding[],
        ),
        conflictCheckedAt: new Date(),
      })
      .where(eq(cases.id, caseId));
  }

  /**
   * Reverse trigger: a new or renamed client/lead/opponent may complete a
   * conflict on existing cases. Matching uses the engine's Arabic-aware
   * normalization, so it is done in memory over the office's cases.
   */
  async rescanForName(
    tx: Tx,
    officeId: string,
    name: string | null | undefined,
    actorId: string | null,
  ) {
    const target = normalizeName(name);
    if (!target) return;
    const all = await tx
      .select({ id: cases.id, opposingParty: cases.opposingParty, clientName: clients.name })
      .from(cases)
      .leftJoin(clients, eq(clients.id, cases.clientId))
      .where(isNull(cases.deletedAt));
    for (const c of all) {
      if (normalizeName(c.opposingParty) === target || normalizeName(c.clientName) === target) {
        await this.recompute(tx, officeId, c.id, actorId);
      }
    }
  }

  /**
   * Flag messages for display, honoring the viewer's row scope: the
   * "other case" rules name other cases, so a viewer who can't see all of
   * them gets a generic message with a count instead of the titles.
   */
  async render(tx: Tx, policy: OfficePolicy, p: Principal, flags: Flag[]) {
    const out = [];
    for (const f of flags) {
      const params = { ...(f.messageParams ?? {}) } as Record<string, string | number>;
      let messageKey = f.messageKey;
      const otherCase =
        f.conflictType === ConflictType.OPPONENT_IS_OUR_CLIENT_OTHER_CASE ||
        f.conflictType === ConflictType.OUR_CLIENT_IS_OPPONENT_OTHER_CASE;
      const ids = (f.matchedCaseIds ?? []).filter(Boolean);
      if (otherCase && ids.length) {
        const visible = await tx
          .select({ id: cases.id })
          .from(cases)
          .where(and(caseVisibility(tx, policy, p), inArray(cases.id, ids)));
        if (visible.length < ids.length) {
          messageKey = `${f.messageKey}Generic`;
          delete params.cases;
          params.count = ids.length;
        }
      }
      out.push({
        id: f.id,
        severity: f.severity,
        status: f.status,
        message: { messageKey, params },
        waiverNote: f.waiverNote,
      });
    }
    return out;
  }
}
