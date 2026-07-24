import { ConflictSeverity } from "@prisma/client";
import { t } from "@/lib/i18n";

/** ⚠ conflict-of-interest chip (docs/06 §4). Presence-only on cards. */
export function ConflictBadge({ severity }: { severity: ConflictSeverity | null }) {
  if (!severity) return null;
  const high = severity === ConflictSeverity.HIGH;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        high ? "bg-advocate/15 text-advocate" : "bg-gold/20 text-warn"
      }`}
    >
      ⚠ {t("conflict.badge")}
    </span>
  );
}
