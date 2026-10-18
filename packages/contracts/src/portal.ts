import {
  CLIENT_APPROVAL_KINDS,
  CLIENT_APPROVAL_STATUSES,
  INVOICE_STATUSES,
  REQUEST_KINDS,
  REQUEST_STATUSES,
} from "@murafaa/rules";
import { UPLOAD_MIME_ALLOW } from "@murafaa/documents";
import { z } from "zod";
import { saudiPhone } from "./auth.js";
import { caseStatus, procStage } from "./cases.js";

const sixDigits = z.string().regex(/^\d{6}$/);

/** Client and employee portals (بوابة العميل / بوابة الموظف): sign-in. */
export const portalVerifyBody = z
  .object({ phone: saudiPhone, code: sixDigits })
  .meta({ id: "PortalVerifyBody" });

export const portalMe = z
  .object({ kind: z.enum(["CLIENT", "EMPLOYEE"]), name: z.string(), officeName: z.string() })
  .meta({ id: "PortalMe" });

// ── Client portal ──

export const portalCaseList = z
  .array(
    z.object({
      id: z.uuid(),
      number: z.string(),
      title: z.string(),
      stage: procStage,
      status: caseStatus,
      nextHearing: z.iso.datetime().nullable(),
    }),
  )
  .meta({ id: "PortalCaseList" });

export const portalCase = z
  .object({
    id: z.uuid(),
    number: z.string(),
    title: z.string(),
    stage: procStage,
    status: caseStatus,
    nextHearing: z.iso.datetime().nullable(),
    objectionDueAt: z.iso.datetime().nullable(),
    documents: z.array(
      z.object({ id: z.uuid(), fileName: z.string(), createdAt: z.iso.datetime() }),
    ),
    messages: z.array(
      z.object({
        id: z.uuid(),
        senderType: z.enum(["STAFF", "CLIENT"]),
        body: z.string(),
        createdAt: z.iso.datetime(),
      }),
    ),
    approvals: z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        kind: z.enum(CLIENT_APPROVAL_KINDS),
        amount: z.number().int().nullable(),
        note: z.string().nullable(),
        status: z.enum(CLIENT_APPROVAL_STATUSES),
        decisionNote: z.string().nullable(),
      }),
    ),
  })
  .meta({ id: "PortalCase" });

export const portalMessageBody = z
  .object({ body: z.string().trim().min(1).max(4000) })
  .meta({ id: "PortalMessageBody" });

export const portalDecideBody = z
  .object({
    approve: z.boolean(),
    note: z
      .string()
      .trim()
      .max(2000)
      .nullish()
      .transform((v) => v || null),
  })
  .meta({ id: "PortalDecideBody" });

export const portalApprovalParams = z.object({ id: z.uuid(), approvalId: z.uuid() });

export const portalUploadQuery = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum([...UPLOAD_MIME_ALLOW] as [string, ...string[]]),
});

export const portalInvoiceList = z
  .array(
    z.object({
      id: z.uuid(),
      number: z.string(),
      caseTitle: z.string().nullable(),
      issueDate: z.iso.date(),
      total: z.number().int(),
      paid: z.number().int(),
      remaining: z.number().int(),
      status: z.enum(INVOICE_STATUSES),
    }),
  )
  .meta({ id: "PortalInvoiceList" });

// ── Employee portal ──

export const empPortalProfile = z
  .object({
    id: z.uuid(),
    name: z.string(),
    jobTitle: z.string().nullable(),
    department: z.string().nullable(),
    leaveBalanceDays: z.number().int(),
    performanceScore: z.number().int().nullable(),
  })
  .meta({ id: "EmpPortalProfile" });

export const empPortalRequests = z
  .array(
    z.object({
      id: z.uuid(),
      kind: z.enum(REQUEST_KINDS),
      detail: z.string().nullable(),
      days: z.number().int().nullable(),
      status: z.enum(REQUEST_STATUSES),
      createdAt: z.iso.datetime(),
    }),
  )
  .meta({ id: "EmpPortalRequests" });

/** A leave request needs its day count (legacy). */
export const empPortalRequestBody = z
  .object({
    kind: z.enum(REQUEST_KINDS),
    detail: z
      .string()
      .trim()
      .max(1000)
      .nullish()
      .transform((v) => v || null),
    days: z.number().int().min(1).max(365).nullish(),
  })
  .refine((b) => b.kind !== "LEAVE" || b.days != null, {
    message: "hr.err.LEAVE_REQUEST_MISSING_DAYS",
    path: ["days"],
  })
  .meta({ id: "EmpPortalRequestBody" });
