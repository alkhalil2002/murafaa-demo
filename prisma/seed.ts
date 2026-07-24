import { PrismaClient, Role } from "@prisma/client";
import {
  ALL_MODULES,
  ALL_ROLES,
  SEED_CASE_SCOPE,
  SEED_FIELD_DENY,
  seedLevel,
} from "../src/lib/permissions/matrix";

const prisma = new PrismaClient();

/**
 * Dev seed: one office, the full permission matrix, one user per role, and a
 * couple of cases with assignees so row-scope can be exercised. Idempotent —
 * re-running reuses the existing office by name.
 */
async function main() {
  const OFFICE_NAME = "مكتب مُرافعة التجريبي";

  const existing = await prisma.office.findFirst({ where: { name: OFFICE_NAME } });
  if (existing) {
    console.info(`Office already seeded (${existing.id}); nothing to do.`);
    return;
  }

  const office = await prisma.office.create({ data: { name: OFFICE_NAME } });

  // Permission matrix (layer 1).
  await prisma.permission.createMany({
    data: ALL_ROLES.flatMap((role) =>
      ALL_MODULES.map((module) => ({
        officeId: office.id,
        role,
        module,
        level: seedLevel(role, module),
      })),
    ),
  });

  // Field denials (layer 2).
  await prisma.fieldPermission.createMany({
    data: SEED_FIELD_DENY.map((f) => ({ officeId: office.id, ...f })),
  });

  // Case scopes (layer 3).
  await prisma.roleCaseScope.createMany({
    data: ALL_ROLES.map((role) => ({
      officeId: office.id,
      role,
      scope: SEED_CASE_SCOPE[role],
    })),
  });

  // One user per role. Phones are E.164 Saudi mobiles.
  const roleUsers: Array<{ name: string; phone: string; role: Role }> = [
    { name: "عبدالله الشريك", phone: "+966500000001", role: Role.PARTNER },
    { name: "منال المحامية", phone: "+966500000002", role: Role.LAWYER },
    { name: "سالم المساعد", phone: "+966500000003", role: Role.ASSISTANT },
    { name: "هند المحاسبة", phone: "+966500000004", role: Role.ACCOUNTANT },
    { name: "ماجد الإداري", phone: "+966500000005", role: Role.ADMIN },
    { name: "نورة الاستقبال", phone: "+966500000006", role: Role.RECEPTION },
  ];
  const users = await Promise.all(
    roleUsers.map((u) =>
      prisma.user.create({ data: { officeId: office.id, ...u } }),
    ),
  );
  const lawyer = users.find((u) => u.role === Role.LAWYER)!;

  // A client and two cases: one assigned to the lawyer, one not — so ASSIGNED
  // scope is visibly different from ALL.
  const client = await prisma.client.create({
    data: {
      officeId: office.id,
      name: "شركة الإمداد التجارية",
      city: "الرياض",
      type: "COMPANY",
    },
  });

  const assignedCase = await prisma.case.create({
    data: {
      officeId: office.id,
      number: "1446/128",
      title: "مطالبة مالية تجارية",
      clientId: client.id,
      opposingParty: "مؤسسة النخبة للمقاولات",
      city: "الرياض",
    },
  });
  await prisma.caseAssignee.create({
    data: { officeId: office.id, caseId: assignedCase.id, userId: lawyer.id },
  });

  await prisma.case.create({
    data: {
      officeId: office.id,
      number: "1446/205",
      title: "نزاع عقاري",
      clientId: client.id,
      opposingParty: "خالد الفهد",
      city: "جدة",
    },
  });

  console.info(`Seeded office ${office.id} with ${users.length} users and 2 cases.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
