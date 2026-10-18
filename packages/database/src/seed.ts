import { createDb, withTenant } from "./client.js";
import { offices, users } from "./schema/index.js";
import { seedOfficePolicy } from "./seed-policy.js";

/**
 * Development seed (legacy prisma/seed.ts): one demo office with the docs/04
 * default permissions and one user per role, phones 0500000001–0500000006.
 * Idempotent. Runs as the app role through withTenant, exactly like a request,
 * so it works under FORCE RLS on Cloud SQL too.
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL (the app role) is required");

const OFFICE_ID = "0f1c0000-0000-4000-8000-000000000001";
const OFFICE_NAME = "مكتب مُرافعة التجريبي";
const USERS = [
  { name: "عبدالله الشريك", phone: "+966500000001", role: "PARTNER" },
  { name: "منال المحامية", phone: "+966500000002", role: "LAWYER" },
  { name: "سالم المساعد", phone: "+966500000003", role: "ASSISTANT" },
  { name: "هند المحاسبة", phone: "+966500000004", role: "ACCOUNTANT" },
  { name: "ماجد الإداري", phone: "+966500000005", role: "ADMIN" },
  { name: "نورة الاستقبال", phone: "+966500000006", role: "RECEPTION" },
] as const;

const { db, close } = createDb(url, { max: 1 });
try {
  await withTenant(db, OFFICE_ID, async (tx) => {
    await tx.insert(offices).values({ id: OFFICE_ID, name: OFFICE_NAME }).onConflictDoNothing();
    await seedOfficePolicy(tx, OFFICE_ID);
    await tx
      .insert(users)
      .values(USERS.map((u) => ({ officeId: OFFICE_ID, ...u })))
      .onConflictDoNothing();
  });
  console.log(`seeded ${OFFICE_NAME}: permissions + ${USERS.length} users (0500000001–0500000006)`);
} finally {
  await close();
}
