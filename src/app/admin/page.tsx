import { redirect } from "next/navigation";
import { SubscriptionStatus } from "@prisma/client";
import { getPlatformSession, destroyPlatformSession } from "@/lib/auth/platform-session";
import { getPlatformOverview, type OfficeRow } from "@/server/platform";
import { formatSar } from "@/lib/money";
import { formatDateAr } from "@/lib/dates";
import { t } from "@/lib/i18n";

const arNum = (n: number) => n.toLocaleString("ar-SA");

/** Access state → the reserved status tone used by the charts. */
function toneFor(row: OfficeRow): string {
  if (row.accessState === "READ_ONLY") return "critical";
  if (row.accessState === "GRACE") return "serious";
  if (row.status === SubscriptionStatus.ACTIVE) return "good";
  return "warning"; // trialing
}

function stateLabel(row: OfficeRow): string {
  if (!row.accessState) return t("admin.state.none");
  if (row.accessState === "READ_ONLY") return t("admin.state.locked");
  if (row.accessState === "GRACE") return t("admin.state.grace", { n: arNum(row.daysRemaining) });
  if (row.status === SubscriptionStatus.ACTIVE) return t("admin.state.active");
  return t("admin.state.trial", { n: arNum(row.daysRemaining) });
}

export default async function AdminDashboardPage() {
  const session = await getPlatformSession();
  if (!session) redirect("/admin/login");

  const { offices, totals } = await getPlatformOverview(session);

  async function signOut() {
    "use server";
    await destroyPlatformSession();
    redirect("/admin/login");
  }

  return (
    <div className="admin-shell">
      <header className="admin-top">
        <div>
          <h1>{t("admin.title")}</h1>
          <p className="sub">{t("admin.subtitle", { name: session.name })}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="tinybtn">
            {t("auth.signout")}
          </button>
        </form>
      </header>

      <div className="kpis kpis-5">
        <div className="kpi">
          <div className="v">{arNum(totals.offices)}</div>
          <div className="l">{t("admin.kpi.offices")}</div>
        </div>
        <div className="kpi">
          <div className="v">{arNum(totals.trialing)}</div>
          <div className="l">{t("admin.kpi.trialing")}</div>
        </div>
        <div className="kpi">
          <div className="v">{arNum(totals.active)}</div>
          <div className="l">{t("admin.kpi.active")}</div>
        </div>
        <div className="kpi">
          <div className="v">{arNum(totals.lapsed)}</div>
          <div className="l">{t("admin.kpi.lapsed")}</div>
        </div>
        <div className="kpi">
          <div className="v">{formatSar(totals.mrrHalalas)}</div>
          <div className="l">{t("admin.kpi.mrr")}</div>
        </div>
      </div>

      <section className="chart-card">
        <div className="chart-head">
          <h2>{t("admin.offices")}</h2>
        </div>
        {/* Metadata only — counts and subscription state, never case or client
            detail. See the note at the top of src/server/platform.ts. */}
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("admin.col.office")}</th>
              <th>{t("admin.col.state")}</th>
              <th>{t("admin.col.plan")}</th>
              <th>{t("admin.col.seats")}</th>
              <th>{t("admin.col.cases")}</th>
              <th>{t("admin.col.since")}</th>
            </tr>
          </thead>
          <tbody>
            {offices.map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>
                  <span className={`status-dot tone-${toneFor(o)}`} aria-hidden="true" />
                  {stateLabel(o)}
                </td>
                <td>{o.planName ?? "—"}</td>
                <td>{arNum(o.seats)}</td>
                <td>{arNum(o.cases)}</td>
                <td>{formatDateAr(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
