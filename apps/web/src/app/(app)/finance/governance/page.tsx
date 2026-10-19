import {
  authCurrent,
  financeApprovals,
  financeAudit,
  financePeriods,
  financeSettings,
} from "@murafaa/sdk";
import { formatSar, formatWhen, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import {
  ApproveButton,
  PeriodLockButton,
  RequireApprovalToggle,
} from "@/components/finance/finance-forms";
import { serverApi } from "@/lib/api";

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-SA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, (m ?? 1) - 1, 1)));
};

/** الحوكمة والإقفال: period locks, the approval switch and queue, finance audit (legacy + prototype finGov). */
export default async function GovernancePage() {
  const api = await serverApi();
  const [me, periodsRes, settingsRes, pendingRes, auditRes] = await Promise.all([
    authCurrent({ client: api }),
    financePeriods({ client: api }),
    financeSettings({ client: api }),
    financeApprovals({ client: api }),
    financeAudit({ client: api }),
  ]);
  const periods = periodsRes.data?.data;
  const settings = settingsRes.data?.data;
  const pending = pendingRes.data?.data;
  const audit = auditRes.data?.data ?? [];
  if (!periods || !settings || !pending) return <DeniedPanel />;
  const user = me.data?.data;
  const preview = Boolean(user?.user.previewRole);
  const canManage = user?.modules.FINANCE === "FULL" && !preview;
  const isPartner = Boolean(user?.isPartner) && !preview;
  const lockedCount = periods.filter((x) => x.locked).length;
  const pendingCount = pending.payments.length + pending.expenses.length;

  return (
    <>
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>
          {t("finGov.hint")}
        </div>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="v">{lockedCount.toLocaleString("ar-SA")}</div>
          <div className="l">{t("finGov.periods.locked")}</div>
        </div>
        <div className="kpi">
          <div className="v">{pendingCount.toLocaleString("ar-SA")}</div>
          <div className="l">{t("finGov.pending.title")}</div>
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finGov.periods.title")}</h2>
        <div className="clist">
          {periods.map((x) => (
            <div key={x.periodKey} className="approve-row">
              <span className="at">{monthLabel(x.periodKey)}</span>
              <span
                className="chip"
                style={{
                  color: x.locked ? "var(--advocate)" : "var(--ok)",
                  borderColor: x.locked ? "var(--advocate)" : "var(--ok)",
                }}
              >
                {x.locked ? t("finGov.periods.locked") : t("finGov.periods.open")}
              </span>
              {canManage && <PeriodLockButton periodKey={x.periodKey} locked={x.locked} />}
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finGov.approval.title")}</h2>
        <div className="approve-row">
          <span className="at">
            {t("finGov.approval.hint")}
            <span className="sub"> {t("finGov.approval.twoPeople")}</span>
          </span>
          {isPartner && <RequireApprovalToggle value={settings.requireApproval} />}
          <span className="chip">{settings.requireApproval ? "✓" : "—"}</span>
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finGov.pending.title")}</h2>
        {pendingCount === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("finGov.pending.empty")}
          </div>
        ) : (
          <>
            {pending.payments.map((x) => (
              <div className="approve-row" key={x.id}>
                <span className="ndot" style={{ background: "var(--amber-400)" }} />
                <span className="at">
                  {t("finGov.pending.payment", {
                    number: x.number,
                    invoice: x.invoiceNumber,
                    client: x.clientName,
                  })}
                </span>
                <span className="chip">{formatSar(x.amount)}</span>
                <span className="chip">{x.date}</span>
                {canManage && <ApproveButton kind="payment" id={x.id} />}
              </div>
            ))}
            {pending.expenses.map((e) => (
              <div className="approve-row" key={e.id}>
                <span className="ndot" style={{ background: "var(--amber-400)" }} />
                <span className="at">
                  {t(`expCat.${e.category}` as MessageKey)}
                  {e.vendor ? ` — ${e.vendor}` : ""}
                </span>
                <span className="chip">{formatSar(e.gross)}</span>
                <span className="chip">{e.date}</span>
                {canManage && <ApproveButton kind="expense" id={e.id} />}
              </div>
            ))}
          </>
        )}
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finGov.auditLog.title")}</h2>
        {audit.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("finance.empty")}
          </div>
        ) : (
          <div className="clist">
            {audit.map((r) => (
              <div key={r.id} className="dcard">
                <div dir="ltr" style={{ textAlign: "start" }}>
                  {r.action}
                  {r.detail ? ` — ${r.detail}` : ""}
                </div>
                <div className="sub">
                  {r.actorName ?? t("events.actor.system")} · {formatWhen(r.at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
