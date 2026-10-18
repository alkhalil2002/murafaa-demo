import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getNotifications } from "@/server/notifications";
import { t } from "@/lib/i18n";
import { RIYADH_TZ } from "@/lib/dates";

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const items = await getNotifications(session);

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("notif.title")}</h2>
        <span className="pill">{t("notif.pill")}</span>
      </div>
      <div className="clist">
        {items.length === 0 ? (
          <div className="panel">
            <div className="sub" style={{ marginBottom: 0 }}>{t("notif.empty")}</div>
          </div>
        ) : (
          items.map((n) => (
            <Link key={n.id} href={n.href} className="approve-row" style={{ cursor: "pointer" }}>
              <span className="ndot" style={{ background: "var(--gold)" }} />
              <span className="at">{n.text}</span>
              <span className="chip">{formatWhen(n.at)}</span>
            </Link>
          ))
        )}
      </div>
    </AppShell>
  );
}
