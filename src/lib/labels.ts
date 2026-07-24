import {
  AppointmentType,
  CaseOutcome,
  CaseStatus,
  ClientStatus,
  ClientType,
  DocKind,
  DocParty,
  DocSource,
  DocumentTemplateCategory,
  ExpenseCategory,
  FeeType,
  HearingKind,
  HearingStatus,
  LeadSource,
  LeadStage,
  PartyRole,
  PaymentMethod,
  PermModule,
  ProcStage,
  Role,
  TaskCategory,
  TaskColumn,
  TaskPriority,
  TrustTxnType,
} from "@prisma/client";
import type { EffectiveInvoiceStatus } from "@/lib/finance/core";
import { t, type MessageKey } from "@/lib/i18n";

/** Enum → i18n key maps, so enum values never leak into the UI untranslated. */
const ROLE_KEY: Record<Role, MessageKey> = {
  [Role.PARTNER]: "role.partner",
  [Role.LAWYER]: "role.lawyer",
  [Role.ASSISTANT]: "role.assistant",
  [Role.ACCOUNTANT]: "role.accountant",
  [Role.ADMIN]: "role.admin",
  [Role.RECEPTION]: "role.reception",
};

const MODULE_KEY: Record<PermModule, MessageKey> = {
  [PermModule.CASES]: "module.cases",
  [PermModule.AI]: "module.ai",
  [PermModule.CLIENTS]: "module.clients",
  [PermModule.DOCUMENTS]: "module.documents",
  [PermModule.FINANCE]: "module.finance",
  [PermModule.HR]: "module.hr",
  [PermModule.REPORTS]: "module.reports",
  [PermModule.PERMISSIONS]: "module.permissions",
  [PermModule.WHATSAPP]: "module.whatsapp",
  [PermModule.APPOINTMENTS]: "module.appointments",
  [PermModule.TASKS]: "module.tasks",
  [PermModule.ALERTS]: "module.alerts",
  [PermModule.PULSE]: "module.pulse",
};

export function roleLabel(role: Role): string {
  return t(ROLE_KEY[role]);
}

export function moduleLabel(module: PermModule): string {
  return t(MODULE_KEY[module]);
}

// Enum → i18n key helpers. Keys follow the `<enum>.<VALUE>` convention so the
// value is looked up directly; a cast keeps them typed against MessageKey.
export const stageLabel = (v: ProcStage) => t(`case.stage.${v}` as MessageKey);
export const caseStatusLabel = (v: CaseStatus) => t(`case.status.${v}` as MessageKey);
export const outcomeLabel = (v: CaseOutcome) => t(`case.outcome.${v}` as MessageKey);
export const partyRoleLabel = (v: PartyRole) =>
  t(v === "PLAINTIFF" ? "cases.role.plaintiff" : "cases.role.defendant");
export const hearingKindLabel = (v: HearingKind) => t(`hearing.kind.${v}` as MessageKey);
export const hearingStatusLabel = (v: HearingStatus) => t(`hearing.status.${v}` as MessageKey);
export const clientTypeLabel = (v: ClientType) => t(`clientType.${v}` as MessageKey);
export const clientStatusLabel = (v: ClientStatus) => t(`clientStatus.${v}` as MessageKey);
export const leadStageLabel = (v: LeadStage) => t(`leadStage.${v}` as MessageKey);
export const leadSourceLabel = (v: LeadSource) => t(`leadSource.${v}` as MessageKey);
export const taskColumnLabel = (v: TaskColumn) => t(`taskColumn.${v}` as MessageKey);
export const taskPriorityLabel = (v: TaskPriority) => t(`taskPriority.${v}` as MessageKey);
export const taskCategoryLabel = (v: TaskCategory) => t(`taskCategory.${v}` as MessageKey);
export const apptTypeLabel = (v: AppointmentType) => t(`apptType.${v}` as MessageKey);
export const docKindLabel = (v: DocKind) => t(`docKind.${v}` as MessageKey);
export const docSourceLabel = (v: DocSource) => t(`docSource.${v}` as MessageKey);
export const docPartyLabel = (v: DocParty) => t(`docParty.${v}` as MessageKey);
export const docCategoryLabel = (v: DocumentTemplateCategory) => t(`docCategory.${v}` as MessageKey);
export const invoiceStatusLabel = (v: EffectiveInvoiceStatus) => t(`invStatus.${v}` as MessageKey);
export const feeTypeLabel = (v: FeeType) => t(`feeType.${v}` as MessageKey);
export const payMethodLabel = (v: PaymentMethod) => t(`payMethod.${v}` as MessageKey);
export const expenseCategoryLabel = (v: ExpenseCategory) => t(`expCat.${v}` as MessageKey);
export const trustTypeLabel = (v: TrustTxnType) => t(`trustType.${v}` as MessageKey);
