import { getAccess } from "@/server/subscription";
import { t } from "@/lib/i18n";

/**
 * Subscription state banner, rendered in the app shell.
 *
 * Silent while a paid subscription is current — a banner that is always on
 * stops being read. Shown during the trial, escalated in the grace window, and
 * persistent once writes are locked.
 */
export async function TrialBanner({ officeId }: { officeId: string }) {
  const access = await getAccess(officeId);
  if (access.state === "ACTIVE") return null;

  const n = access.daysRemaining.toLocaleString("ar-SA");
  const [text, tone] =
    access.state === "TRIAL"
      ? [t("billing.trial.banner", { n }), "trial"]
      : access.state === "GRACE"
        ? [t("billing.grace.banner", { n }), "grace"]
        : [t("billing.locked.banner"), "locked"];

  return (
    <div className={`trial-banner tone-${tone}`} role="status">
      <span>{text}</span>
    </div>
  );
}
