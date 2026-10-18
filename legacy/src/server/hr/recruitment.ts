import { CandidateStage, LeadSource, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";

/**
 * التوظيف (docs/03 `RECRUIT`) — a 4-stage ATS pipeline mirroring the CRM
 * lead pipeline's shape and single-step move semantics. Reaching HIRED is
 * just the terminal pipeline stage; the actual Employee record is created
 * separately via the existing "تعيين موظف جديد" form (a hire needs
 * salary/hireDate/department a candidate record doesn't carry).
 */

const STAGE_ORDER: CandidateStage[] = [
  CandidateStage.APPLIED,
  CandidateStage.INTERVIEW,
  CandidateStage.OFFER,
  CandidateStage.HIRED,
];

const createSchema = z.object({
  name: z.string().trim().min(1),
  roleTitle: z.string().nullish(),
  source: z.nativeEnum(LeadSource).optional(),
});
export type CreateCandidateInput = z.infer<typeof createSchema>;

export async function listCandidates(session: AppSession) {
  await requireModule(session, PermModule.HR, "view");
  return prisma.candidate.findMany({
    where: { officeId: session.officeId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function createCandidate(session: AppSession, raw: CreateCandidateInput) {
  await requireModule(session, PermModule.HR, "edit");
  const input = createSchema.parse(raw);
  const created = await prisma.candidate.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      name: input.name,
      roleTitle: input.roleTitle ?? null,
      source: input.source ?? LeadSource.OTHER,
    },
  });
  await logAudit({ session, action: "candidate.create", resource: "hr", targetId: created.id, detail: created.name });
  return created;
}

/** Single-step, bounded pipeline move. dir ∈ {-1,+1}. */
export async function moveCandidate(session: AppSession, id: string, dir: 1 | -1) {
  await requireModule(session, PermModule.HR, "edit");
  const candidate = await prisma.candidate.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!candidate) throw new PermissionError("scope");
  const idx = STAGE_ORDER.indexOf(candidate.stage);
  const next = idx + dir;
  if (next < 0 || next >= STAGE_ORDER.length) return candidate;
  const updated = await prisma.candidate.update({
    where: { id },
    data: { stage: STAGE_ORDER[next]! },
  });
  await logAudit({ session, action: "candidate.move", resource: "hr", targetId: id, detail: updated.stage });
  return updated;
}

export async function deleteCandidate(session: AppSession, id: string) {
  await requireModule(session, PermModule.HR, "edit");
  const candidate = await prisma.candidate.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!candidate) throw new PermissionError("scope");
  await prisma.candidate.update({ where: { id }, data: { deletedAt: new Date() } });
  await logAudit({ session, action: "candidate.delete", resource: "hr", targetId: id });
}
