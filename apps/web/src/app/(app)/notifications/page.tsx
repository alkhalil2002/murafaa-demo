import Link from "next/link";
import { overviewNotifications } from "@murafaa/sdk";
import { formatWhen, t, tStored } from "@murafaa/i18n";
import { serverApi } from "@/lib/api";

/** الإشعارات (legacy notifications page): a live feed, newest first. */
export default async function NotificationsPage() {
  const api = await serverApi();
  const items = (await overviewNotifications({ client: api })).data?.data ?? [];
  return (
    <>
      <div className="vhead">
        <h2>{t("notif.title")}</h2>
        <span className="pill">{t("notif.pill")}</span>
      </div>
      <div className="clist">
        {items.length === 0 ? (
          <div className="panel">
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("notif.empty")}
            </div>
          </div>
        ) : (
          items.map((n) => (
            <Link key={n.id} href={n.href} className="approve-row" style={{ cursor: "pointer" }}>
              <span className="ndot" style={{ background: "var(--gold)" }} />
              <span className="at">{tStored(n.message.messageKey, n.message.params)}</span>
              <span className="chip">{formatWhen(n.at)}</span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
