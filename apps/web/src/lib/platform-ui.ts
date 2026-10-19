import { subscriptionDueDate } from "@murafaa/rules";
import type { PlatformOffice } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { arNum, urgencyText, urgencyTone } from "./portal-data";

export const STATUS_TONE: Record<PlatformOffice["status"], string> = {
  ACTIVE: "t-ok",
  TRIAL: "t-warn",
  SUSPENDED: "t-danger",
};

export const statusLabel = (s: PlatformOffice["status"]) => t(`platform.status.${s}` as MessageKey);

/** The trial end or paid-until day, with its countdown chip; null once suspended or undated. */
export function dueOf(o: PlatformOffice): { date: string; text: string; tone: string } | null {
  const date = subscriptionDueDate(o);
  return date ? { date, text: urgencyText(date), tone: urgencyTone(date) } : null;
}

export const storageMb = (bytes: number) =>
  t("platform.storage", { n: arNum(Math.round((bytes / (1024 * 1024)) * 10) / 10) });

/** An audit action as words, or the raw action when it has no label yet. */
export function actionLabel(action: string): string {
  const key = `platform.action.${action}` as MessageKey;
  const label = t(key);
  return label === key || !label ? action : label;
}
