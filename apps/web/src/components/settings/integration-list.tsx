import type { IntegrationList as Rows } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";

/**
 * Government platforms and their real connection status (docs/02 §7). None is
 * connected without a signed API contract; nothing is simulated.
 */
export function IntegrationList({ rows }: { rows: Rows }) {
  return (
    <div className="clist">
      {rows.map((r) => {
        const connected = r.status === "CONNECTED";
        return (
          <div
            key={r.key}
            className="dcard"
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <span style={{ fontSize: 22.5, color: connected ? "var(--ok)" : "var(--ink-soft)" }}>
              ●
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{t(`integration.name.${r.key}` as MessageKey)}</div>
              <div className="sub">{t(`integration.desc.${r.key}` as MessageKey)}</div>
              <div className="sub">
                {connected ? t("hr.integ.connected") : t("hr.integ.notConnected")}
              </div>
              {r.phase1Ready !== undefined && (
                <div className="sub" style={{ color: r.phase1Ready ? "var(--ok)" : "var(--warn)" }}>
                  {r.phase1Ready
                    ? t("integration.zatcaPhase1Ready")
                    : t("integration.zatcaPhase1Missing")}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
