/**
 * Dev-only integration smoke test for Phase 2 services against the seeded DB.
 * Proves the real service paths (not just pure units): row-scope filtering,
 * convertLead transaction, and the judgment→objection auto-task + idempotency.
 * Run after `npm run db:seed`: npx tsx scripts/phase2-check.ts
 */
import { HearingKind, HearingStatus, LeadStage, Role } from "@prisma/client";
import { setNextHearing } from "../src/server/hearings";
import { prisma } from "../src/lib/db";
import type { AppSession } from "../src/lib/auth/types";
import { listCases } from "../src/server/cases";
import { recordHearing } from "../src/server/hearings";
import { convertLead } from "../src/server/leads";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗ FAIL"} ${name}`);
  if (!cond) failures++;
}

async function main() {
  const office = await prisma.office.findFirstOrThrow({ where: { name: { contains: "التجريبي" } } });
  const users = await prisma.user.findMany({ where: { officeId: office.id } });
  const partner = users.find((u) => u.role === Role.PARTNER)!;
  const lawyer = users.find((u) => u.role === Role.LAWYER)!;
  const mk = (u: typeof partner): AppSession => ({
    userId: u.id,
    officeId: office.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
  });

  // 1) Row scope: lawyer (ASSIGNED) sees fewer cases than partner (ALL).
  const partnerCases = await listCases(mk(partner));
  const lawyerCases = await listCases(mk(lawyer));
  check("partner sees all seeded cases (>= 4)", partnerCases.length >= 4);
  check("lawyer sees only assigned cases (< partner)", lawyerCases.length < partnerCases.length);
  check(
    "lawyer's cases are only ones they're assigned to",
    lawyerCases.every((c) => c.assignees.some((a) => a.userId === lawyer.id)),
  );

  // 2) convertLead: contracted lead → client (+phone carried) + case, atomically.
  const lead = await prisma.lead.findFirstOrThrow({
    where: { officeId: office.id, stage: LeadStage.CONTRACTED, deletedAt: null },
  });
  const { client, newCase } = await convertLead(mk(partner), lead.id);
  check("convertLead created a client", !!client.id);
  check("convertLead carried the lead phone onto the client", client.phone === lead.phone);
  check("convertLead created a linked case", newCase.clientId === client.id);
  const leadAfter = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
  check("lead left the active pipeline (soft-deleted + provenance set)",
    leadAfter.deletedAt !== null && leadAfter.convertedClientId === client.id);

  // 3) Judgment hearing → objection deadline + urgent auto-task, idempotent.
  const caseA = partnerCases.find((c) => c.title.includes("مطالبة مالية"))!;
  await recordHearing(mk(partner), caseA.id, {
    hearingDate: new Date("2026-07-24"),
    kind: HearingKind.JUDGMENT_PRONOUNCEMENT,
    result: "صدر الحكم لصالح موكّلنا",
    stageIndex: 1,
  });
  const caseAfter = await prisma.case.findUniqueOrThrow({ where: { id: caseA.id } });
  const objDue = caseAfter.objectionDueAt?.toISOString().slice(0, 10);
  check("objection deadline = judgment + 30 days", objDue === "2026-08-23");
  const objTasks1 = await prisma.task.count({
    where: { officeId: office.id, caseId: caseA.id, origin: "AUTO_OBJECTION" },
  });
  check("one urgent objection task auto-created", objTasks1 === 1);

  // Re-record the same judgment → must NOT duplicate the objection task.
  await recordHearing(mk(partner), caseA.id, {
    hearingDate: new Date("2026-07-24"),
    kind: HearingKind.JUDGMENT_PRONOUNCEMENT,
    result: "صدر الحكم لصالح موكّلنا",
    stageIndex: 1,
  });
  const objTasks2 = await prisma.task.count({
    where: { officeId: office.id, caseId: caseA.id, origin: "AUTO_OBJECTION" },
  });
  check("objection task is idempotent (still 1 after re-record)", objTasks2 === 1);

  // 4) Regression (review #1): a NON-judgment hearing whose minutes mention
  //    "المحكمة" must NOT trigger the objection deadline/task.
  const caseB = lawyerCases.find((c) => c.title.includes("عقاري"))!;
  await recordHearing(mk(partner), caseB.id, {
    hearingDate: new Date("2026-03-01"),
    kind: HearingKind.PRELIMINARY,
    minutes: "عقدت المحكمة الجلسة الأولى وجرى تبادل المذكرات",
    stageIndex: 1,
  });
  const caseBAfter = await prisma.case.findUniqueOrThrow({ where: { id: caseB.id } });
  const objTasksB = await prisma.task.count({
    where: { officeId: office.id, caseId: caseB.id, origin: "AUTO_OBJECTION" },
  });
  check("preliminary hearing mentioning المحكمة does NOT set objection deadline", caseBAfter.objectionDueAt === null);
  check("preliminary hearing creates no objection task", objTasksB === 0);

  // 5) Regression (review #5): recording a held hearing clears a stale upcoming.
  await setNextHearing(mk(partner), caseB.id, new Date("2026-05-01"));
  const upcomingBefore = await prisma.hearing.count({
    where: { officeId: office.id, caseId: caseB.id, status: HearingStatus.UPCOMING, deletedAt: null },
  });
  await recordHearing(mk(partner), caseB.id, {
    hearingDate: new Date("2026-04-01"),
    kind: HearingKind.PLEADING,
    stageIndex: 1,
  });
  const upcomingAfter = await prisma.hearing.count({
    where: { officeId: office.id, caseId: caseB.id, status: HearingStatus.UPCOMING, deletedAt: null },
  });
  check("setNextHearing created one upcoming", upcomingBefore === 1);
  check("recording a held hearing cleared the stale upcoming", upcomingAfter === 0);

  // 6) Regression (review #9): converting the same lead twice throws (idempotent).
  let doubleConvertThrew = false;
  try {
    await convertLead(mk(partner), lead.id);
  } catch {
    doubleConvertThrew = true;
  }
  check("second convertLead on the same lead is rejected", doubleConvertThrew);

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
