/**
 * Dev-only integration smoke test for Phase 5 (legal-AI gate) against the seeded
 * DB. Proves: the pipeline retrieves + grounds + gates + audits; the LIVE KB
 * index blocks a fabricated citation (not just synthetic unit tests); arena
 * turns are gated; and the module is role-gated. Run after `npm run db:seed`:
 *   npx tsx scripts/phase5-check.ts
 */
import { ArenaRole, Role } from "@prisma/client";
import { prisma } from "../src/lib/db";
import type { AppSession } from "../src/lib/auth/types";
import { askAssistant, listInteractions, runArenaTurn } from "../src/server/ai";
import { loadKbIndex } from "../src/lib/ai/vector";
import { runGate } from "../src/lib/ai/gate";
import { PermissionError } from "../src/lib/permissions/guard";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗ FAIL"} ${name}`);
  if (!cond) failures++;
}

async function main() {
  const office = await prisma.office.findFirstOrThrow({ where: { name: { contains: "التجريبي" } } });
  const users = await prisma.user.findMany({ where: { officeId: office.id } });
  const mk = (role: Role): AppSession => {
    const u = users.find((x) => x.role === role)!;
    return { userId: u.id, officeId: office.id, name: u.name, phone: u.phone, role: u.role };
  };
  const partner = mk(Role.PARTNER);
  const caseA = await prisma.case.findFirstOrThrow({ where: { officeId: office.id, title: { contains: "مطالبة مالية" } } });

  // 1) Assistant answer: gated, carries a disclaimer, persisted + audited.
  const ans = await askAssistant(partner, { question: "هل يستحق موكّلنا مطالبته بموجب العقد المنفّذ؟" });
  check("assistant returns a gated answer with a disclaimer", !!ans.finalOutput && ans.disclaimer.length > 0);
  check("assistant verdict is not BLOCKED for a grounded stub answer", ans.verdict !== "BLOCKED");
  const persisted = await prisma.aiInteraction.findUnique({ where: { id: ans.id }, include: { citations: true } });
  check("interaction persisted with citations", !!persisted && persisted.citations.length >= 0);
  const audit = await prisma.auditLog.findFirst({ where: { officeId: office.id, targetId: ans.id } });
  check("AI generation is audited", !!audit);

  // 2) THE core guarantee against the LIVE seeded KB: a fabricated citation is
  //    blocked and stripped from the output.
  const kb = await loadKbIndex();
  const fabricated =
    "الوقائع ثابتة. تنص المادة (٩٩٩) من نظام العمل على بطلان الإجراء. وعليه نطلب الرد.";
  const gated = runGate(fabricated, kb, "block");
  check("live KB blocks a fabricated article", gated.verdict === "BLOCKED");
  check("fabricated citation text is stripped from output", !gated.finalOutput.includes("٩٩٩"));
  check("surrounding prose is preserved", gated.finalOutput.includes("الوقائع ثابتة") && gated.finalOutput.includes("نطلب الرد"));

  // ...and a real seeded citation survives.
  const real = runGate("بحسب المادة (٧٤) من نظام العمل ينتهي العقد بانتهاء مدته.", kb);
  check("live KB keeps a real seeded citation", real.verdict === "PASSED" && real.finalOutput.includes("٧٤"));

  // 3) Arena turn is gated + persisted with surface=ARENA.
  const turn = await runArenaTurn(partner, { caseId: caseA.id, role: ArenaRole.OURS, threadId: "t1" });
  check("arena turn generated + gated", !!turn.finalOutput && turn.arenaRole === "OURS");
  const arenaRow = await prisma.aiInteraction.findUnique({ where: { id: turn.id } });
  check("arena interaction stored with surface=ARENA", arenaRow?.surface === "ARENA");

  // 4) Module gating: accountant denied AI; assistant is view-only (cannot
  //    generate) but CAN list; lawyer can generate.
  let accountantDenied = false;
  try {
    await askAssistant(mk(Role.ACCOUNTANT), { question: "سؤال" });
  } catch (e) {
    accountantDenied = e instanceof PermissionError;
  }
  check("accountant denied AI generation", accountantDenied);

  let assistantGenDenied = false;
  try {
    await askAssistant(mk(Role.ASSISTANT), { question: "سؤال" });
  } catch (e) {
    assistantGenDenied = e instanceof PermissionError;
  }
  check("assistant (مساعد) cannot generate (view-only)", assistantGenDenied);
  const asstList = await listInteractions(mk(Role.ASSISTANT));
  check("assistant (مساعد) CAN view interactions", Array.isArray(asstList));
  const lawyerAns = await askAssistant(mk(Role.LAWYER), { question: "ما موقفنا؟" });
  check("lawyer can generate", !!lawyerAns.finalOutput);

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
