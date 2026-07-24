import { PermModule, Role } from "@prisma/client";
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
