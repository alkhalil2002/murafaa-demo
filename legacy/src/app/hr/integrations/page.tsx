import { redirect } from "next/navigation";
import { PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { HrTabs } from "@/components/hr-tabs";
import { ErrBanner } from "@/components/hr-ui";
import { getSession } from "@/lib/auth/session";
import { listIntegrations } from "@/server/hr/integrations";
import { canAction, PermissionError } from "@/lib/permissions/guard";
import { integrationLabel, integrationDescLabel } from "@/lib/labels";
import { RIYADH_TZ } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { connectIntegrationAction, disconnectIntegrationAction, syncIntegrationNowAction } from "../actions";

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { err } = await searchParams;

  let content: React.ReactNode;
  try {
    const [rows, canEdit] = await Promise.all([
      listIntegrations(session),
      canAction(session, PermModule.HR, "edit"),
    ]);

    content = (
      <>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("hr.integ.hint")}</div>
        </div>
        <div className="clist">
          {rows.map((r) => (
            <div key={r.key} className="dcard" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22.5, color: r.connected ? "var(--ok)" : "var(--ink-soft)" }}>●</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{integrationLabel(r.key)}</div>
                <div className="sub">{integrationDescLabel(r.key)}</div>
                <div className="sub">
                  {r.connected ? t("hr.integ.connected") : t("hr.integ.notConnected")}
                  {r.connected && (
                    <> · {t("hr.integ.lastSync")}: {r.lastSyncedAt ? formatWhen(r.lastSyncedAt) : t("hr.integ.never")}</>
                  )}
                </div>
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  {r.connected ? (
                    <>
                      <form action={syncIntegrationNowAction}>
                        <input type="hidden" name="key" value={r.key} />
                        <button type="submit" className="tinybtn">{t("hr.integ.syncNow")}</button>
                      </form>
                      <form action={disconnectIntegrationAction}>
                        <input type="hidden" name="key" value={r.key} />
                        <button type="submit" className="tinybtn del">{t("hr.integ.disconnect")}</button>
                      </form>
                    </>
                  ) : (
                    <form action={connectIntegrationAction}>
                      <input type="hidden" name="key" value={r.key} />
                      <button type="submit" className="act b-add">{t("hr.integ.connect")}</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    );
  } catch (e) {
    if (e instanceof PermissionError) content = <DeniedPanel />;
    else throw e;
  }

  return (
    <AppShell>
      <div className="vhead"><h2>{t("hr.title")}</h2></div>
      <HrTabs />
      <ErrBanner code={err} />
      {content}
    </AppShell>
  );
}
