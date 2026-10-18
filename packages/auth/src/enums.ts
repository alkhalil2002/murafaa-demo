/** Permission enums (docs/04). Values match the database enums in @murafaa/database. */

export const Role = {
  PARTNER: "PARTNER",
  LAWYER: "LAWYER",
  ASSISTANT: "ASSISTANT",
  ACCOUNTANT: "ACCOUNTANT",
  ADMIN: "ADMIN",
  RECEPTION: "RECEPTION",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const PermModule = {
  CASES: "CASES",
  AI: "AI",
  CLIENTS: "CLIENTS",
  DOCUMENTS: "DOCUMENTS",
  FINANCE: "FINANCE",
  HR: "HR",
  REPORTS: "REPORTS",
  PERMISSIONS: "PERMISSIONS",
  WHATSAPP: "WHATSAPP",
  APPOINTMENTS: "APPOINTMENTS",
  TASKS: "TASKS",
  ALERTS: "ALERTS",
  PULSE: "PULSE",
} as const;
export type PermModule = (typeof PermModule)[keyof typeof PermModule];

export const PermLevel = {
  NONE: "NONE",
  VIEW: "VIEW",
  EDIT: "EDIT",
  FULL: "FULL",
} as const;
export type PermLevel = (typeof PermLevel)[keyof typeof PermLevel];

export const CaseScope = {
  ALL: "ALL",
  ASSIGNED: "ASSIGNED",
} as const;
export type CaseScope = (typeof CaseScope)[keyof typeof CaseScope];
