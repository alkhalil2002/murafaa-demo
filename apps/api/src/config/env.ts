import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.url(),
    CORS_ORIGINS: z
      .string()
      .default("")
      .transform((s) =>
        s
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      ),
    RBAC_ENFORCEMENT: z.enum(["strict", "permissive"]).default("strict"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    APP_VERSION: z.string().default("0.0.0"),
    /** HMAC key for stored OTP codes. Required: an empty key would make the hashes guessable. */
    AUTH_SECRET: z.string().min(32),
    /** 32-byte base64 key for encrypting TOTP secrets at rest (AES-256-GCM). */
    ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 bytes, base64-encoded"),
    /** console = dev only (code returned to the client and logged); unifonic = real SMS/WhatsApp. */
    OTP_PROVIDER: z.enum(["console", "unifonic"]).default("console"),
    /** Document bytes: local disk for development, Google Cloud Storage (me-central2) in production. */
    STORAGE_DRIVER: z.enum(["local", "gcs"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().default(".storage"),
    GCS_BUCKET: z.string().optional(),
  })
  .refine((e) => e.NODE_ENV !== "production" || e.RBAC_ENFORCEMENT === "strict", {
    message: "RBAC_ENFORCEMENT must be 'strict' in production",
    path: ["RBAC_ENFORCEMENT"],
  })
  .refine((e) => e.NODE_ENV !== "production" || e.STORAGE_DRIVER === "gcs", {
    message: "documents must be stored in GCS (Dammam) in production, not on local disk",
    path: ["STORAGE_DRIVER"],
  })
  .refine((e) => e.STORAGE_DRIVER !== "gcs" || Boolean(e.GCS_BUCKET), {
    message: "GCS_BUCKET is required when STORAGE_DRIVER=gcs",
    path: ["GCS_BUCKET"],
  })
  .refine((e) => e.NODE_ENV !== "production" || e.OTP_PROVIDER !== "console", {
    message:
      "OTP_PROVIDER=console would return login codes to the client; not allowed in production",
    path: ["OTP_PROVIDER"],
  });

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol("ENV");

/** Parse the environment once at boot; any problem stops the process before it serves traffic. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
