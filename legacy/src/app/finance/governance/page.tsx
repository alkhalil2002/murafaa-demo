import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { listRecentPeriods, getRequireApproval, listFinanceAudit } from "@/server/finance-governance";
import { PermissionError, canAction } from "@/lib/permissions/guard";
import { PermModule } from "@prisma/client";
import { RIYADH_TZ } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { setPeriodLockAction, setRequireApprovalAction } from "../actions";

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium", timeStyle: "short" }).format(d);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-SA", { month: "long", year: "numeric" }).format(new Date(y!, (m ?? 1) - 1, 1));
}

export default async function GovernancePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const [periods, requireApproval, auditRows, canManage] = await Promise.all([
      listRecentPeriods(session),
      getRequireApproval(session),
      listFinanceAudit(session),
      canAction(session, PermModule.FINANCE, "delete"),
    ]);

    content = (
      <>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("finGov.hint")}</div>
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("finGov.periods.title")}</h2>
          <div className="clist">
            {periods.map((p) => (
              <div key={p.periodKey} className="approve-row">
                <span className="at">{monthLabel(p.periodKey)}</span>
                <span className="chip" style={{ color: p.locked ? "var(--advocate)" : "var(--ok)", borderColor: p.locked ? "var(--advocate)" : "var(--ok)" }}>
                  {p.locked ? t("finGov.periods.locked") : t("finGov.periods.open")}
                </span>
                {canManage && (
                  <form action={setPeriodLockAction}>
                    <input type="hidden" name="periodKey" value={p.periodKey} />
                    <input type="hidden" name="locked" value={(!p.locked).toString()} />
                    <button type="submit" className="tinybtn">
                      {p.locked ? t("finGov.periods.unlock") : t("finGov.periods.lock")}
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("finGov.approval.title")}</h2>
          <div className="approve-row">
            <span className="at">{t("finGov.approval.hint")}</span>
            {canManage ? (
              <form action={setRequireApprovalAction}>
                <input type="hidden" name="value" value={(!requireApproval).toString()} />
                <button type="submit" className="tinybtn">
                  {requireApproval ? t("finGov.approval.disable") : t("finGov.approval.enable")}
                </button>
              </form>
            ) : null}
            <span className="chip">{requireApproval ? "✓" : "—"}</span>
          </div>
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("finGov.auditLog.title")}</h2>
          {auditRows.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>{t("finance.empty")}</div>
          ) : (
            <div className="clist">
              {auditRows.map((r) => (
                <div key={r.id} className="dcard">
                  <div>{r.action}{r.detail ? ` — ${r.detail}` : ""}</div>
                  <div className="sub">{r.actorName ?? t("common.system")} · {formatWhen(r.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead"><h2>{t("finance.title")}</h2></div>
      <FinanceTabs />
      {content}
    </AppShell>
  );
}
