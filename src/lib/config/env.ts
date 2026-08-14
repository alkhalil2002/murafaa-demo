/**
 * Startup configuration checks.
 *
 * Run once at boot (src/instrumentation.ts). The point is to turn silent
 * misconfiguration into a loud refusal to start, because the worst failures in
 * this system are the quiet ones:
 *
 *   STORAGE_DRIVER unset on Cloud Run means documents are written to a
 *   container filesystem that is destroyed on the next restart or scale-down.
 *   No error, no log line, no missing-file exception until a lawyer opens a
 *   case months later and the evidence is gone.
 *
 * A container that will lose data must not accept traffic. Failing at boot
 * costs one failed revision; failing silently costs a client's case file.
 */

export type EnvIssue = { level: "fatal" | "warn"; key: string; message: string };

/**
 * Only the keys this module reads. Deliberately looser than NodeJS.ProcessEnv
 * so callers (and tests) can pass a small object without casting; process.env
 * satisfies it structurally.
 */
export type EnvLike = Record<string, string | undefined>;

const DEV_SECRET_MARKERS = ["change-me", "changeme", "example", "placeholder"];

/** Pure so it can be unit-tested without touching process.env. */
export function checkEnv(env: EnvLike): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const isProd = env.NODE_ENV === "production";

  if (!env.DATABASE_URL) {
    issues.push({ level: "fatal", key: "DATABASE_URL", message: "not set — the app cannot serve anything" });
  }

  const secret = env.AUTH_SECRET ?? "";
  if (!secret) {
    issues.push({ level: "fatal", key: "AUTH_SECRET", message: "not set — sessions and OTP hashes would be unsigned" });
  } else if (isProd && DEV_SECRET_MARKERS.some((m) => secret.toLowerCase().includes(m))) {
    issues.push({
      level: "fatal",
      key: "AUTH_SECRET",
      message: "still the development placeholder — every session cookie and OTP hash is forgeable",
    });
  } else if (isProd && secret.length < 32) {
    issues.push({ level: "fatal", key: "AUTH_SECRET", message: "shorter than 32 chars — generate with `openssl rand -base64 32`" });
  }

  // The data-loss guard. Local storage is correct in dev and catastrophic on
  // any host with an ephemeral container filesystem (Cloud Run, Vercel, a
  // Railway service with no volume attached), so production must opt in to a
  // durable target explicitly. "volume" is that opt-in: same filesystem
  // driver, but the operator is asserting a persistent disk is mounted there.
  const driver = env.STORAGE_DRIVER ?? "local";
  if (isProd && driver === "local") {
    issues.push({
      level: "fatal",
      key: "STORAGE_DRIVER",
      message:
        "is 'local' in production. The container filesystem is ephemeral, so every uploaded document " +
        "would be destroyed on the next restart or redeploy — silently. Set STORAGE_DRIVER=gcs with a " +
        "GCS_BUCKET, or STORAGE_DRIVER=volume with STORAGE_LOCAL_DIR pointing at a mounted persistent disk.",
    });
  }
  if (driver === "gcs" && !env.GCS_BUCKET) {
    issues.push({ level: "fatal", key: "GCS_BUCKET", message: "required when STORAGE_DRIVER=gcs" });
  }
  if (driver === "volume" && !env.STORAGE_LOCAL_DIR) {
    issues.push({
      level: "fatal",
      key: "STORAGE_LOCAL_DIR",
      message:
        "required when STORAGE_DRIVER=volume — it must be the mount path of the persistent disk. " +
        "Without it the driver would write to the ephemeral default and lose every document.",
    });
  }
  if (isProd && driver === "volume") {
    issues.push({
      level: "warn",
      key: "STORAGE_DRIVER",
      message:
        "is 'volume' — documents live on one disk attached to one instance. That rules out running " +
        "more than one replica, and backups are your responsibility (a bucket has neither limit).",
    });
  }

  const otp = env.OTP_PROVIDER ?? "console";
  if (otp === "whatsapp") {
    // Both are required together; a provider with one of them is a login
    // system that fails on first use rather than at boot.
    if (!env.WHATSAPP_OTP_URL) {
      issues.push({ level: "fatal", key: "WHATSAPP_OTP_URL", message: "required when OTP_PROVIDER=whatsapp" });
    }
    if (!env.WHATSAPP_OTP_TOKEN) {
      issues.push({ level: "fatal", key: "WHATSAPP_OTP_TOKEN", message: "required when OTP_PROVIDER=whatsapp" });
    }
  }

  // Not fatal: an internal staging deploy legitimately reads codes from the
  // logs. It must never be quiet about it, though.
  if (isProd && otp === "console") {
    issues.push({
      level: "warn",
      key: "OTP_PROVIDER",
      message:
        "is 'console' in production — login codes are written to the server log and nothing is sent. " +
        "Acceptable for internal staging only; real users cannot sign in.",
    });
  }

  return issues;
}

/** Log the findings and refuse to start if any are fatal. */
export function assertEnv(env: EnvLike = process.env): void {
  const issues = checkEnv(env);
  for (const i of issues.filter((x) => x.level === "warn")) {
    console.warn(`[config] WARNING ${i.key}: ${i.message}`);
  }
  const fatal = issues.filter((i) => i.level === "fatal");
  if (fatal.length === 0) return;

  for (const i of fatal) console.error(`[config] FATAL ${i.key}: ${i.message}`);
  throw new Error(
    `Refusing to start: ${fatal.length} fatal configuration problem(s) — ${fatal.map((f) => f.key).join(", ")}`,
  );
}
