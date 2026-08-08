import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { signOut } from "@/lib/auth";
import { listRecycleBin } from "@/server/settings";
import { restoreRecycleItemAction, purgeRecycleBinAction } from "./actions";
import { RIYADH_TZ } from "@/lib/dates";
import { t, type MessageKey } from "@/lib/i18n";

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium" }).format(d);
}

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const items = await listRecycleBin(session);

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("settings.title")}</h2>
      </div>

      <div className="panel">
        <div className="vhead" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{t("settings.recycle.title")}</h2>
          {items.length > 0 && (
            <form action={purgeRecycleBinAction}>
              <button type="submit" className="tinybtn del">
                {t("settings.recycle.purge")}
              </button>
            </form>
          )}
        </div>
        <div className="sub" style={{ marginBottom: 12 }}>{t("settings.recycle.hint")}</div>
        {items.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>{t("settings.recycle.empty")}</div>
        ) : (
          <div className="clist">
            {items.map((item) => (
              <div key={`${item.kind}:${item.id}`} className="approve-row">
                <span className="chip">{t(`settings.recycle.kind.${item.kind}` as MessageKey)}</span>
                <span className="at">{item.label}</span>
                <span className="sub" style={{ marginInlineEnd: 8 }}>{formatWhen(item.deletedAt)}</span>
                <form action={restoreRecycleItemAction}>
                  <input type="hidden" name="kind" value={item.kind} />
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="tinybtn">
                    {t("settings.recycle.restore")}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("settings.account.title")}</h2>
        <div className="field">
          <label>{t("settings.account.phone")}</label>
          <input type="text" readOnly dir="ltr" value={session.phone} />
        </div>
        <div className="field">
          <label>{t("settings.account.hosting")}</label>
          <div className="sub">{t("settings.account.hostingValue")}</div>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="tinybtn del">
            {t("settings.account.logout")}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
