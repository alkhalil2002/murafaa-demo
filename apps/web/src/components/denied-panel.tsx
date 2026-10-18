import { t } from "@murafaa/i18n";

/** Shown when the API refuses a module the role cannot open (legacy DeniedPanel). */
export function DeniedPanel() {
  return (
    <div className="rounded-2xl border border-line bg-white p-8 text-center text-ink-soft">
      {t("perm.denied.module")}
    </div>
  );
}
