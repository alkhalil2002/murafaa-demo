import { t } from "@murafaa/i18n";

/** ⚠ conflict-of-interest chip on case cards (docs/06 §4). */
export function ConflictBadge({ severity }: { severity: "HIGH" | "MEDIUM" | null }) {
  if (!severity) return null;
  const high = severity === "HIGH";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        high
          ? "bg-advocate/15 text-advocate"
          : "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]"
      }`}
    >
      ⚠ {t("conflict.badge")}
    </span>
  );
}
