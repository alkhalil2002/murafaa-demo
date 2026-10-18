import { t, type MessageKey } from "@murafaa/i18n";
import { HR_INTEGRATION_KEYS } from "@murafaa/rules";
import { HrHeader } from "../hr-header";

/**
 * التكاملات (legacy /hr/integrations). No government platform is connected
 * yet (M7), so every one is shown not connected with no connect button:
 * legacy's connect/sync toggles simulated a link that did not exist, which
 * the owner decision on fabricated integrations rules out.
 */
export default function IntegrationsPage() {
  return (
    <>
      <HrHeader />
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>
          {t("hr.integ.pending")}
        </div>
      </div>
      <div className="clist">
        {HR_INTEGRATION_KEYS.map((key) => (
          <div
            key={key}
            className="dcard"
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <span style={{ fontSize: 22.5, color: "var(--ink-soft)" }}>●</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{t(`hr.integ.name.${key}` as MessageKey)}</div>
              <div className="sub">{t(`hr.integ.desc.${key}` as MessageKey)}</div>
              <div className="sub">{t("hr.integ.notConnected")}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
