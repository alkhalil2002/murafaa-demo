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
  })
  .refine((e) => e.NODE_ENV !== "production" || e.RBAC_ENFORCEMENT === "strict", {
    message: "RBAC_ENFORCEMENT must be 'strict' in production",
    path: ["RBAC_ENFORCEMENT"],
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
