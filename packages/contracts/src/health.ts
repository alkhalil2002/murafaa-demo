import { z } from "zod";

export const healthResponse = z
  .object({
    status: z.enum(["ok", "degraded"]),
    db: z.enum(["up", "down"]),
    version: z.string(),
  })
  .meta({ id: "Health" });
export type HealthResponse = z.infer<typeof healthResponse>;
