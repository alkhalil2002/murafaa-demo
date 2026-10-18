import { z } from "zod";

export const officeId = z.uuid();

export const office = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(200),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "Office" });
export type Office = z.infer<typeof office>;

export const createOfficeBody = z
  .object({
    name: z.string().trim().min(1).max(200),
  })
  .meta({ id: "CreateOfficeBody" });
export type CreateOfficeBody = z.infer<typeof createOfficeBody>;
