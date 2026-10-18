/**
 * Dev-only smoke test: drives the real sendOtp/verifyOtp against the seeded DB
 * to prove the auth core works end-to-end (not just compiles). Not part of the
 * test suite (it needs a live DB + seed). Run: npx tsx scripts/otp-check.ts
 */
import { sendOtp, verifyOtp } from "../src/lib/auth/otp";
import { prisma } from "../src/lib/db";

async function main() {
  const phone = "+966500000002"; // seeded lawyer

  // Capture the code the console provider prints.
  let captured = "";
  const orig = console.info;
  console.info = (...args: unknown[]) => {
    const line = args.join(" ");
    const m = line.match(/:\s*(\d{6})\s*$/);
    if (m) captured = m[1]!;
    orig(...args);
  };

  const sent = await sendOtp(phone, "whatsapp");
  console.info = orig;
  console.log("send:", sent, "code captured:", captured ? "yes" : "no");

  const bad = await verifyOtp(phone, "000000" === captured ? "111111" : "000000");
  console.log("verify wrong code:", bad.ok ? "UNEXPECTED OK" : `rejected (${bad.code})`);

  const good = await verifyOtp(phone, captured);
  console.log(
    "verify correct code:",
    good.ok ? `OK → ${good.user.name} / ${good.user.role}` : `FAIL (${good.code})`,
  );

  const auditCount = await prisma.auditLog.count({
    where: { action: { in: ["auth.otp.sent", "auth.login"] } },
  });
  console.log("audit rows (otp.sent + login):", auditCount);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
