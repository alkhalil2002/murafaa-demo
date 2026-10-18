import { INTEGRATION_STATUSES, INTEGRATIONS, isValidCrNumber } from "@murafaa/rules";
import { z } from "zod";
import { optionalVatNumber } from "./crm.js";

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

/** ZATCA tax profile printed on every tax invoice (VAT and CR numbers, national address). */
export const officeTaxProfile = z
  .object({
    vatNumber: optionalVatNumber,
    crNumber: z
      .string()
      .trim()
      .nullish()
      .transform((v) => v || null)
      .refine((v) => v == null || isValidCrNumber(v), { message: "errors.CR_NUMBER_INVALID" }),
    taxAddress: z
      .string()
      .trim()
      .max(300)
      .nullish()
      .transform((v) => v || null),
  })
  .meta({ id: "OfficeTaxProfile" });

export const integrationList = z
  .array(
    z.object({
      key: z.enum(INTEGRATIONS.map((i) => i.key)),
      group: z.enum(["LEGAL", "FINANCE", "HR"]),
      status: z.enum(INTEGRATION_STATUSES),
      /** ZATCA only: phase 1 (QR on printed invoices) is ready once the office has a VAT number. */
      phase1Ready: z.boolean().optional(),
    }),
  )
  .meta({ id: "IntegrationList" });
