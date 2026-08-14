/**
 * Seeds the PLATFORM side: sellable plans and Murafaa's own staff logins.
 *
 * Separate from prisma/seed.ts on purpose — that seeds a demo TENANT, this
 * seeds the operator. Idempotent: safe to re-run.
 *
 * Plan prices are placeholders in halalas, VAT-exclusive. Replace them with
 * real pricing before any of this is shown to a customer.
 */
import { PrismaClient } from "@prisma/client";
import { riyalsToHalalas } from "../src/lib/money";

const prisma = new PrismaClient();

const PLANS = [
  { code: "starter", nameAr: "الأساسية", priceHalalas: riyalsToHalalas(499), seatLimit: 5, sortOrder: 1 },
  { code: "practice", nameAr: "المكتب", priceHalalas: riyalsToHalalas(1299), seatLimit: 20, sortOrder: 2 },
  { code: "firm", nameAr: "المؤسسة", priceHalalas: riyalsToHalalas(2999), seatLimit: null, sortOrder: 3 },
];

// The owner's real number. Upsert keys on `phone`, so changing this value
// creates a NEW admin rather than renaming the old one — the previous
// placeholder is deactivated explicitly below.
const ADMINS = [{ name: "مدير المنصّة", phone: "+966590015636" }];

/** Placeholder numbers from earlier seeds, retired rather than left able to sign in. */
const RETIRED_ADMIN_PHONES = ["+966555000001"];

async function main() {
  for (const p of PLANS) {
    await prisma.plan.upsert({ where: { code: p.code }, update: p, create: p });
  }
  for (const a of ADMINS) {
    await prisma.platformAdmin.upsert({
      where: { phone: a.phone },
      update: { name: a.name, isActive: true },
      create: a,
    });
  }
  const retired = await prisma.platformAdmin.updateMany({
    where: { phone: { in: RETIRED_ADMIN_PHONES } },
    data: { isActive: false },
  });
  console.info(
    `Seeded ${PLANS.length} plans and ${ADMINS.length} platform admin(s); retired ${retired.count}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
