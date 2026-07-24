import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { signOut } from "@/lib/auth";
import { roleLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

/**
 * The "today" landing screen (docs/05 — free view). Phase 1 shows only the
 * authenticated identity + role; the real day-launcher is built in Phase 2.
 */
export default async function TodayPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-bench">{t("common.today")}</h1>
          <p className="mt-1 text-ink-soft">
            {t("common.welcome")} {session.name} —{" "}
            <span className="font-semibold text-bench">{roleLabel(session.role)}</span>
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-xl border border-line px-4 py-2 text-sm text-ink-soft hover:bg-parch"
          >
            {t("auth.signout")}
          </button>
        </form>
      </header>

      <section className="rounded-2xl border border-line bg-white p-6">
        <p className="text-ink-soft">
          {t("app.name")} · {t("app.tagline")}
        </p>
      </section>
    </main>
  );
}
