import Link from "next/link";
import { overviewAlerts } from "@murafaa/sdk";
import { t, tStored, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

const TIER_ICON: Record<string, string> = { critical: "🔴", important: "🟡", info: "📂" };
const TIER_COLOR: Record<string, string> = {
  critical: "var(--advocate)",
  important: "var(--amber-600)",
  info: "var(--ink-soft)",
};

/** التنبيهات الذكية (legacy alerts page). */
export default async function AlertsPage() {
  const api = await serverApi();
  const items = (await overviewAlerts({ client: api })).data?.data;
  return (
    <>
      <div className="vhead">
        <h2>{t("alerts.title")}</h2>
        <span className="pill">{t("alerts.pill")}</span>
      </div>
      {!items ? (
        <DeniedPanel />
      ) : (
        <>
          <div className="panel">
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("alerts.hint")}
            </div>
          </div>
          {items.length === 0 ? (
            <div className="panel">
              <div className="sub" style={{ marginBottom: 0 }}>
                {t("alerts.empty")}
              </div>
            </div>
          ) : (
            <div className="clist">
              {items.map((a) => (
                <div
                  key={a.id}
                  className="dcard"
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <span style={{ fontSize: 22.5 }}>{TIER_ICON[a.tier]}</span>
                  <div style={{ flex: 1 }}>
                    <div
                      className="chip"
                      style={{
                        color: TIER_COLOR[a.tier],
                        borderColor: TIER_COLOR[a.tier],
                        marginBottom: 6,
                      }}
                    >
                      {t(`alerts.tier.${a.tier}` as MessageKey)}
                    </div>
                    <div>{tStored(a.message.messageKey, a.message.params)}</div>
                  </div>
                  <Link href={a.href} className="tinybtn">
                    {t("alerts.open")}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
