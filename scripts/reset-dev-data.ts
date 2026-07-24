/**
 * Dev-only: wipe all APP ROWS (keeping the schema + migration history) so the
 * seed can repopulate a clean state. Deletes in FK-safe order. Never run this
 * against anything but a local dev database. Najiz reference rows are kept.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.conflictFlag.deleteMany();
  await prisma.caseReminder.deleteMany();
  await prisma.caseEvent.deleteMany();
  await prisma.hearing.deleteMany();
  await prisma.task.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.caseAssignee.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.case.deleteMany();
  await prisma.client.deleteMany();
  await prisma.otpChallenge.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.fieldPermission.deleteMany();
  await prisma.roleCaseScope.deleteMany();
  await prisma.user.deleteMany();
  await prisma.office.deleteMany();
  console.info("Cleared app rows (schema kept).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
