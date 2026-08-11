import {
  CaseEventType,
  ClientStatus,
  ClientType,
  LeadSource,
  LeadStage,
  PermModule,
  ProcStage,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { logPerformance } from "@/lib/performance";
import { t } from "@/lib/i18n";
import { NAJIZ } from "@/lib/najiz";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { normalizeSaudiPhone } from "@/lib/auth/phone";
import { recomputeCaseConflicts, rescanConflictsForName } from "@/lib/conflict/service";

/**
 * Leads / CRM pipeline service (docs/03, docs/06 §4). Gated by the العملاء
 * module. convertLead atomically turns a CONTRACTED lead into a client + an
 * auto-created case (docs BR-CRM-CONVERT), carrying the phone across (fixing
 * the prototype's phone-drop bug) and recomputing conflicts on the new case.
 */

const STAGE_ORDER: LeadStage[] = [
  LeadStage.PROSPECT,
  LeadStage.FIRST_CONSULTATION,
  LeadStage.FEE_PROPOSAL_SENT,
  LeadStage.CONTRACTED,
];

const createSchema = z.object({
  name: z.string().trim().min(1),
  type: z.nativeEnum(ClientType).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  stage: z.nativeEnum(LeadStage).optional(),
  expectedValue: z.number().int().min(0).optional(), // halalas
  nextAction: z.string().nullish(),
  phone: z.string().nullish(),
});
export type CreateLeadInput = z.infer<typeof createSchema>;

export async function listLeads(session: AppSession) {
  await requireModule(session, PermModule.CLIENTS, "view");
  return prisma.lead.findMany({
    where: { officeId: session.officeId, deletedAt: null, convertedClientId: null },
    orderBy: { createdAt: "desc" },
  });
}

/** CRM KPI strip (prototype pipeline header): active pipeline count/value + all-time conversion rate. */
export async function getLeadsKpis(session: AppSession) {
  await requireModule(session, PermModule.CLIENTS, "view");
  const [active, everCreated, converted] = await Promise.all([
    prisma.lead.findMany({
      where: { officeId: session.officeId, deletedAt: null, convertedClientId: null },
      select: { expectedValue: true },
    }),
    prisma.lead.count({ where: { officeId: session.officeId } }),
    prisma.lead.count({ where: { officeId: session.officeId, convertedClientId: { not: null } } }),
  ]);
  return {
    activeCount: active.length,
    pipelineValue: active.reduce((sum, l) => sum + l.expectedValue, 0),
    conversionRatePct: everCreated > 0 ? Math.round((converted / everCreated) * 100) : 0,
  };
}

export async function createLead(session: AppSession, raw: CreateLeadInput) {
  await requireModule(session, PermModule.CLIENTS, "edit");
  const input = createSchema.parse(raw);
  const created = await prisma.lead.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      name: input.name,
      type: input.type ?? ClientType.INDIVIDUAL,
      source: input.source ?? LeadSource.OTHER,
      stage: input.stage ?? LeadStage.PROSPECT,
      expectedValue: input.expectedValue ?? 0,
      nextAction: input.nextAction ?? null,
      phone: input.phone ? normalizeSaudiPhone(input.phone) : null,
    },
  });
  await logAudit({ session, action: "lead.create", resource: "clients", targetId: created.id, detail: created.name });
  // Reverse trigger: a new lead may complete a MEDIUM conflict on an existing case.
  await rescanConflictsForName(session, created.name);
  return created;
}

const updateSchema = z.object({
  name: z.string().trim().min(1),
  expectedValue: z.number().int().min(0).optional(),
  nextAction: z.string().nullish(),
  phone: z.string().nullish(),
});
export type UpdateLeadInput = z.infer<typeof updateSchema>;

export async function updateLead(session: AppSession, id: string, raw: UpdateLeadInput) {
  await requireModule(session, PermModule.CLIENTS, "edit");
  const input = updateSchema.parse(raw);
  const lead = await prisma.lead.findFirst({ where: { id, officeId: session.officeId, deletedAt: null } });
  if (!lead) throw new PermissionError("scope");
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      name: input.name,
      expectedValue: input.expectedValue ?? lead.expectedValue,
      nextAction: input.nextAction ?? null,
      phone: input.phone ? normalizeSaudiPhone(input.phone) : null,
    },
  });
  await logAudit({ session, action: "lead.update", resource: "clients", targetId: id });
  if (updated.name !== lead.name) await rescanConflictsForName(session, updated.name);
  return updated;
}

export async function deleteLead(session: AppSession, id: string) {
  await requireModule(session, PermModule.CLIENTS, "delete");
  const lead = await prisma.lead.findFirst({ where: { id, officeId: session.officeId, deletedAt: null } });
  if (!lead) throw new PermissionError("scope");
  await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ session, action: "lead.delete", resource: "clients", targetId: id });
}

/** Single-step, bounded pipeline move (docs BR-CRM-MOVE). dir ∈ {-1,+1}. */
export async function moveLead(session: AppSession, id: string, dir: 1 | -1) {
  await requireModule(session, PermModule.CLIENTS, "edit");
  const lead = await prisma.lead.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!lead) throw new PermissionError("scope");
  const idx = STAGE_ORDER.indexOf(lead.stage);
  const next = idx + dir;
  if (next < 0 || next >= STAGE_ORDER.length) return lead; // bounded, no-op
  const updated = await prisma.lead.update({
    where: { id },
    data: { stage: STAGE_ORDER[next]! },
  });
  await logAudit({ session, action: "lead.move", resource: "clients", targetId: id, detail: updated.stage });
  return updated;
}

/**
 * Move a lead to an explicit stage.
 *
 * `moveLead` above steps ±1 and is what the back/forward buttons use. Drag and
 * drop needs an absolute target — a card can be dropped on any column, not
 * just an adjacent one — so this takes the destination directly. Same module
 * gate, same tenancy check, same audit action as the stepped move.
 */
export async function setLeadStage(session: AppSession, id: string, stage: LeadStage) {
  await requireModule(session, PermModule.CLIENTS, "edit");
  const lead = await prisma.lead.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!lead) throw new PermissionError("scope");
  if (lead.stage === stage) return lead; // dropped on its own column — no-op
  const updated = await prisma.lead.update({ where: { id }, data: { stage } });
  await logAudit({ session, action: "lead.move", resource: "clients", targetId: id, detail: stage });
  return updated;
}

/**
 * Convert a CONTRACTED lead into a Client + auto Case, atomically
 * (docs BR-CRM-CONVERT). Only CONTRACTED leads are convertible.
 */
export async function convertLead(session: AppSession, id: string) {
  await requireModule(session, PermModule.CLIENTS, "edit");
  const lead = await prisma.lead.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!lead) throw new PermissionError("scope");
  if (lead.stage !== LeadStage.CONTRACTED) {
    throw new Error("LEAD_NOT_CONTRACTED: only contracted leads can be converted");
  }

  // Najiz defaults: first main → first sub → first case type (prototype parity).
  const mainClass = Object.keys(NAJIZ)[0]!;
  const subs = NAJIZ[mainClass as keyof typeof NAJIZ] as Record<string, readonly string[]>;
  const subClass = Object.keys(subs)[0]!;
  const caseType = subs[subClass]![0]!;

  const { client, newCase } = await prisma.$transaction(async (tx) => {
    // Atomic claim: flip the lead out of the pipeline only if it is still a
    // CONTRACTED, unconverted lead. A concurrent/double-submit conversion finds
    // count === 0 and aborts — so exactly one client+case pair is created.
    const claimed = await tx.lead.updateMany({
      where: {
        id,
        officeId: session.officeId,
        deletedAt: null,
        stage: LeadStage.CONTRACTED,
        convertedClientId: null,
      },
      data: { deletedAt: new Date() }, // leaves the active pipeline
    });
    if (claimed.count === 0) {
      throw new Error("LEAD_ALREADY_CONVERTED: this lead was already converted");
    }

    // Office phone is unique (portal login key). If a client already holds this
    // phone, don't copy it again — avoid the unique-constraint failure.
    let phone = lead.phone;
    if (phone) {
      const dup = await tx.client.findFirst({
        where: { officeId: session.officeId, phone },
        select: { id: true },
      });
      if (dup) phone = null;
    }

    const client = await tx.client.create({
      data: {
        officeId: session.officeId,
        createdById: session.userId,
        name: lead.name,
        type: lead.type,
        status: ClientStatus.ACTIVE,
        // Carry the phone across (prototype bug: it dropped the phone).
        phone,
      },
    });
    const newCase = await tx.case.create({
      data: {
        officeId: session.officeId,
        createdById: session.userId,
        number: "—",
        title: t("case.autoTitleFromLead", { name: lead.name }),
        clientId: client.id,
        najizMainClass: mainClass,
        najizSubClass: subClass,
        najizCaseType: caseType,
        stage: ProcStage.FIRST_INSTANCE,
      },
    });
    await tx.lead.update({
      where: { id },
      data: { convertedClientId: client.id, convertedCaseId: newCase.id },
    });
    await logCaseEvent(tx, {
      officeId: session.officeId,
      caseId: newCase.id,
      type: CaseEventType.SYSTEM,
      description: t("event.leadConverted", { name: lead.name }),
      actorUserId: session.userId,
    });
    await recomputeCaseConflicts(session, newCase.id, tx);
    await logPerformance(tx, {
      officeId: session.officeId,
      userId: session.userId,
      kind: "LEAD_CONVERTED",
    });
    return { client, newCase };
  });

  await logAudit({
    session,
    action: "lead.convert",
    resource: "clients",
    targetId: id,
    detail: `→ client ${client.id}, case ${newCase.id}`,
  });
  // A new client name may complete conflicts on other existing cases.
  await rescanConflictsForName(session, client.name);
  return { client, newCase };
}
