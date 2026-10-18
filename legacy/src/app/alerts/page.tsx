import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getSmartAlerts, type AlertTier } from "@/server/alerts";
import { PermissionError } from "@/lib/permissions/guard";
import { t, type MessageKey } from "@/lib/i18n";

const TIER_ICON: Record<AlertTier, string> = { critical: "🔴", important: "🟡", info: "📂" };
const TIER_COLOR: Record<AlertTier, string> = {
  critical: "var(--advocate)",
  important: "var(--gold)",
  info: "var(--ink-soft)",
};

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const items = await getSmartAlerts(session);
    content = (
      <>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("alerts.hint")}</div>
        </div>
        {items.length === 0 ? (
          <div className="panel">
            <div className="sub" style={{ marginBottom: 0 }}>{t("alerts.empty")}</div>
          </div>
        ) : (
          <div className="clist">
            {items.map((a) => (
              <div key={a.id} className="dcard" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22.5 }}>{TIER_ICON[a.tier]}</span>
                <div style={{ flex: 1 }}>
                  <div className="chip" style={{ color: TIER_COLOR[a.tier], borderColor: TIER_COLOR[a.tier], marginBottom: 6 }}>
                    {t(`alerts.tier.${a.tier}` as MessageKey)}
                  </div>
                  <div>{a.text}</div>
                </div>
                <Link href={a.href} className="tinybtn">
                  {t("alerts.open")}
                </Link>
              </div>
            ))}
          </div>
        )}
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("alerts.title")}</h2>
        <span className="pill">{t("alerts.pill")}</span>
      </div>
      {content}
    </AppShell>
  );
}
