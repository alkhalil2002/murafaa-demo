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
    /**
     * Where إدارة المنصة may sign in from (exact IPs or IPv4 CIDRs, comma
     * separated). Empty = anywhere; set it in production.
     */
    PLATFORM_IP_ALLOWLIST: z
      .string()
      .default("")
      .transform((s) =>
        s
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      ),
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
    /** The internal PDF service (apps/pdf). Unset: generating PDFs answers UNAVAILABLE, nothing is faked. */
    PDF_SERVICE_URL: z.url().optional(),
    PDF_SERVICE_TOKEN: z.string().min(32).optional(),
    /**
     * The legal-AI model provider. "none": every AI feature answers UNAVAILABLE
     * (nothing is generated or faked). "vertex": Claude on Vertex AI in
     * VERTEX_REGION; data residency requires an in-Kingdom region (PDPL).
     */
    AI_PROVIDER: z.enum(["none", "vertex"]).default("none"),
    VERTEX_PROJECT_ID: z.string().optional(),
    VERTEX_REGION: z.string().default("me-central2"),
    AI_MODEL: z.string().optional(),
  })
  .refine((e) => e.NODE_ENV !== "production" || e.RBAC_ENFORCEMENT === "strict", {
    message: "RBAC_ENFORCEMENT must be 'strict' in production",
    path: ["RBAC_ENFORCEMENT"],
  })
  .refine((e) => e.NODE_ENV !== "production" || e.STORAGE_DRIVER === "gcs", {
    message: "documents must be stored in GCS (Dammam) in production, not on local disk",
    path: ["STORAGE_DRIVER"],
  })
  .refine((e) => Boolean(e.PDF_SERVICE_URL) === Boolean(e.PDF_SERVICE_TOKEN), {
    message: "PDF_SERVICE_URL and PDF_SERVICE_TOKEN go together",
    path: ["PDF_SERVICE_TOKEN"],
  })
  .refine(
    (e) => e.AI_PROVIDER !== "vertex" || (Boolean(e.VERTEX_PROJECT_ID) && Boolean(e.AI_MODEL)),
    {
      message: "AI_PROVIDER=vertex needs VERTEX_PROJECT_ID and AI_MODEL",
      path: ["AI_PROVIDER"],
    },
  )
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
