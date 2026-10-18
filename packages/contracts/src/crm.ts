import {
  CLIENT_STATUSES,
  CLIENT_TYPES,
  LEAD_SOURCES,
  LEAD_STAGES,
  isValidVatNumber,
  normalizeSaudiPhone,
} from "@murafaa/rules";
import { z } from "zod";

/** An optional Saudi mobile: blank → null; otherwise normalized to E.164 or rejected. */
export const optionalSaudiPhone = z
  .string()
  .trim()
  .max(20)
  .nullish()
  .transform((value, ctx) => {
    if (!value) return null;
    const phone = normalizeSaudiPhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "auth.error.phoneInvalid" });
      return z.NEVER;
    }
    return phone;
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

export const clientType = z.enum(CLIENT_TYPES);

/** A Saudi VAT number (15 digits starting and ending with 3), or none. */
export const optionalVatNumber = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v == null || isValidVatNumber(v), { message: "errors.VAT_NUMBER_INVALID" });
export const clientStatus = z.enum(CLIENT_STATUSES);
export const leadSource = z.enum(LEAD_SOURCES);
export const leadStage = z.enum(LEAD_STAGES);
/** Money is integer halalas (CLAUDE.md conventions). */
export const halalas = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const client = z
  .object({
    id: z.uuid(),
    name: z.string(),
    phone: z.string().nullable(),
    vatNumber: z.string().nullable(),
    city: z.string().nullable(),
    type: clientType,
    status: clientStatus,
    /** Active cases for this client (0 until the cases module lands). */
    casesCount: z.number().int(),
  })
  .meta({ id: "Client" });
export const clientList = z.array(client).meta({ id: "ClientList" });

export const createClientBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    phone: optionalSaudiPhone,
    vatNumber: optionalVatNumber,
    city: optionalText(100),
    type: clientType.default("INDIVIDUAL"),
    status: clientStatus.default("ACTIVE"),
  })
  .meta({ id: "CreateClientBody" });

export const updateClientBody = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    phone: optionalSaudiPhone.optional(),
    vatNumber: optionalVatNumber.optional(),
    city: optionalText(100).optional(),
    type: clientType.optional(),
    status: clientStatus.optional(),
  })
  .meta({ id: "UpdateClientBody" });

export const lead = z
  .object({
    id: z.uuid(),
    name: z.string(),
    type: clientType,
    source: leadSource,
    stage: leadStage,
    expectedValue: halalas,
    nextAction: z.string().nullable(),
    phone: z.string().nullable(),
  })
  .meta({ id: "Lead" });
export const leadList = z.array(lead).meta({ id: "LeadList" });

export const createLeadBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: clientType.default("INDIVIDUAL"),
    source: leadSource.default("OTHER"),
    stage: leadStage.default("PROSPECT"),
    expectedValue: halalas.default(0),
    nextAction: optionalText(500),
    phone: optionalSaudiPhone,
  })
  .meta({ id: "CreateLeadBody" });

/** Legacy edit form: blank next action or phone clears it. */
export const updateLeadBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    expectedValue: halalas.optional(),
    nextAction: optionalText(500),
    phone: optionalSaudiPhone,
  })
  .meta({ id: "UpdateLeadBody" });

export const moveLeadBody = z
  .object({ direction: z.union([z.literal(1), z.literal(-1)]) })
  .meta({ id: "MoveLeadBody" });

/** CRM KPI strip shown on the clients screen (legacy getLeadsKpis). */
export const leadsKpis = z
  .object({
    activeCount: z.number().int(),
    pipelineValue: halalas,
    conversionRatePct: z.number().int(),
  })
  .meta({ id: "LeadsKpis" });

export const idParams = z.object({ id: z.uuid() });
