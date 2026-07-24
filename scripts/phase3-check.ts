/**
 * Dev-only integration smoke test for Phase 3 (documents) against the seeded DB.
 * Proves real service paths: template generation → PDF → object storage →
 * Document row, authorized download, field-deny (assistant/fees), module gating
 * (accountant denied), and client-share toggle. Run after `npm run db:seed`:
 *   npx tsx scripts/phase3-check.ts
 */
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/db";
import type { AppSession } from "../src/lib/auth/types";
import {
  generateFromTemplate,
  getDocumentForDownload,
  prepareGenerateForm,
  toggleShare,
} from "../src/server/documents";
import { listCases } from "../src/server/cases";
import { getStorage } from "../src/lib/storage";
import { closePdfEngine } from "../src/lib/pdf/render";
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

  const cases = await listCases(partner);
  const caseA = cases.find((c) => c.title.includes("مطالبة مالية"))!;

  // 1) Generate a claim document (real PDF → storage → Document row).
  const doc = await generateFromTemplate(partner, {
    templateKey: "claim",
    caseId: caseA.id,
    values: { amount: "50000", facts: "أنجزنا الأعمال بموجب العقد.", claims: "إلزام المدّعى عليه بالسداد." },
  });
  check("generated doc is a TEMPLATE source", doc.source === "TEMPLATE");
  check("generated doc is application/pdf", doc.mimeType === "application/pdf");
  check("generated PDF has real bytes (>2KB)", doc.sizeBytes > 2000);
  check("generated doc has a frozen Hijri generatedDate", doc.generatedDate !== null);

  // 2) Stored object is a real PDF.
  const bytes = await getStorage().get(doc.storageKey);
  check("stored object starts with %PDF", bytes.slice(0, 5).toString() === "%PDF-");

  // 3) Authorized download returns the same bytes.
  const dl = await getDocumentForDownload(partner, doc.id);
  check("download returns PDF bytes", dl.bytes.slice(0, 5).toString() === "%PDF-");
  check("download filename ends with .pdf", dl.fileName.endsWith(".pdf"));

  // 4) Field-deny: assistant does NOT get fee fields on the engage template.
  const asstForm = await prepareGenerateForm(mk(Role.ASSISTANT), "engage", null);
  check("assistant engage form omits feeType", !asstForm.fields.some((f) => f.id === "feeType"));
  check("assistant engage form omits feeValue", !asstForm.fields.some((f) => f.id === "feeValue"));
  const partnerForm = await prepareGenerateForm(partner, "engage", null);
  check("partner engage form includes fee fields", partnerForm.fields.some((f) => f.id === "feeType"));

  // 5) Module gating: accountant (DOCUMENTS=none) cannot generate.
  let accountantDenied = false;
  try {
    await generateFromTemplate(mk(Role.ACCOUNTANT), { templateKey: "claim", caseId: null, values: {} });
  } catch (e) {
    accountantDenied = e instanceof PermissionError;
  }
  check("accountant is denied document generation", accountantDenied);

  // 6) Share toggle flips client visibility.
  const shared = await toggleShare(partner, doc.id);
  check("share sets clientVisible + sharedAt", shared.clientVisible && shared.clientSharedAt !== null);
  const unshared = await toggleShare(partner, doc.id);
  check("unshare clears clientVisible", !unshared.clientVisible && unshared.clientSharedAt === null);

  // 7) Tenancy: an unknown id resolves to nothing (no cross-office leak).
  let notFound = false;
  try {
    await getDocumentForDownload(partner, "00000000-0000-0000-0000-000000000000");
  } catch (e) {
    notFound = e instanceof PermissionError;
  }
  check("unknown document id is rejected", notFound);

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} CHECK(S) FAILED`);
  await closePdfEngine();
  if (failures) process.exit(1);
}

main()
  .catch(async (e) => {
    console.error(e);
    await closePdfEngine();
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
