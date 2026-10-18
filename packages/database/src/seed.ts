import postgres from "postgres";

/**
 * Development seed (legacy prisma/seed.ts): one demo office and one user per
 * role, phones 0500000001–0500000006. Idempotent. Runs as the table owner,
 * which is still subject to FORCE RLS, so it scopes itself to the office.
 */
const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("MIGRATION_DATABASE_URL is required");

const OFFICE_ID = "0f1c0000-0000-4000-8000-000000000001";
const OFFICE_NAME = "مكتب مُرافعة التجريبي";
const USERS: Array<[name: string, phone: string, role: string]> = [
  ["عبدالله الشريك", "+966500000001", "PARTNER"],
  ["منال المحامية", "+966500000002", "LAWYER"],
  ["سالم المساعد", "+966500000003", "ASSISTANT"],
  ["هند المحاسبة", "+966500000004", "ACCOUNTANT"],
  ["ماجد الإداري", "+966500000005", "ADMIN"],
  ["نورة الاستقبال", "+966500000006", "RECEPTION"],
];

const sql = postgres(url, { max: 1 });
try {
  await sql.begin(async (tx) => {
    await tx`select set_config('app.office_id', ${OFFICE_ID}, true)`;
    await tx`insert into offices (id, name) values (${OFFICE_ID}, ${OFFICE_NAME}) on conflict (id) do nothing`;
    for (const [name, phone, role] of USERS) {
      await tx`insert into users (office_id, name, phone, role) values (${OFFICE_ID}, ${name}, ${phone}, ${role})
               on conflict (office_id, phone) do nothing`;
    }
  });
  console.log(`seeded ${OFFICE_NAME} with ${USERS.length} users (0500000001–0500000006)`);
} finally {
  await sql.end();
}
