import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppShell } from "@/components/app-shell";
import { roleLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

/**
 * The "today" landing screen (docs/05 — free view). Phase 2 shows the identity
 * and routes into the operational modules via the shell nav; the rich daily
 * launcher (agenda, alerts) is fleshed out in later phases.
 */
export default async function TodayPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <h1 className="font-serif text-3xl text-bench">{t("common.today")}</h1>
      <p className="mt-1 text-ink-soft">
        {t("common.welcome")} {session.name} —{" "}
        <span className="font-semibold text-bench">{roleLabel(session.role)}</span>
      </p>
      <section className="mt-6 rounded-2xl border border-line bg-white p-6 text-ink-soft">
        {t("app.name")} · {t("app.tagline")}
      </section>
    </AppShell>
  );
}
