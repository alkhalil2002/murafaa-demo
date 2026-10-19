import Link from "next/link";
import { platformDetail } from "@murafaa/sdk";
import { roleLabel, t, type MessageKey } from "@murafaa/i18n";
import { OfficeStatusButton, SubscriptionForm } from "@/components/platform/office-controls";
import { serverApi } from "@/lib/api";
import { fmtDate, relTime } from "@/lib/dates-ui";
import { actionLabel, dueOf, STATUS_TONE, statusLabel, storageMb } from "@/lib/platform-ui";
import { arNum, platformMeData } from "@/lib/portal-data";

const TABS: Array<[string, MessageKey]> = [
  ["overview", "platform.tab.overview"],
  ["staff", "platform.tab.staff"],
  ["subscription", "platform.tab.subscription"],
  ["audit", "platform.tab.audit"],
];

/** ملف المكتب: metadata, counts, staff accounts, subscription and its audit trail. */
export default async function PlatformOfficePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const tab = (await searchParams).tab ?? "overview";
  const o = (await platformDetail({ client: await serverApi(), path: { id } })).data?.data;
  if (!o)
    return (
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>
          {t("errors.NOT_FOUND")}
        </div>
      </div>
    );
  const due = dueOf(o);
  const actions = (await platformMeData())?.actions ?? [];
  const row = (label: string, value: React.ReactNode) => (
    <div className="approve-row">
      <span className="at">{label}</span>
      {value}
    </div>
  );
  return (
    <>
      <Link href="/platform" className="backbtn">
        ‹ {t("platform.nav.offices")}
      </Link>
      <div className="vhead">
        <h2>{o.name}</h2>
        <span className={`chip ${STATUS_TONE[o.status]}`}>{statusLabel(o.status)}</span>
        <span className="pill">
          {o.city ? `${o.city} · ` : ""}
          {t("platform.since", { date: fmtDate(o.createdAt) })}
        </span>
        {actions.includes("office.status") && <OfficeStatusButton office={o} />}
      </div>
      <div className="ftabs">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={
              key === "overview"
                ? `/platform/offices/${o.id}`
                : `/platform/offices/${o.id}?tab=${key}`
            }
            className={`ftab${tab === key ? " on" : ""}`}
          >
            {t(label)}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="kpis">
            <div className="kpi">
              <div className="v">{arNum(o.users)}</div>
              <div className="l">{t("platform.kpi.officeUsers")}</div>
            </div>
            <div className="kpi">
              <div className="v">{arNum(o.cases)}</div>
              <div className="l">{t("platform.kpi.cases")}</div>
            </div>
            <div className="kpi">
              <div className="v">{arNum(o.clients)}</div>
              <div className="l">{t("platform.kpi.clients")}</div>
            </div>
            <div className="kpi">
              <div className="v">{arNum(o.documents)}</div>
              <div className="l">{t("platform.kpi.documents")}</div>
            </div>
          </div>
          <div className="grid2" style={{ alignItems: "start" }}>
            <div className="panel">
              <h2>{t("platform.panel.info")}</h2>
              {row(
                t("platform.field.ownerName"),
                <span className="chip">{o.ownerName ?? "—"}</span>,
              )}
              {row(
                t("platform.field.ownerPhone"),
                <span className="chip" dir="ltr">
                  {o.ownerPhone ?? "—"}
                </span>,
              )}
              {o.crNumber &&
                row(
                  t("platform.field.cr"),
                  <span className="chip" dir="ltr">
                    {o.crNumber}
                  </span>,
                )}
              {o.licenseNumber &&
                row(
                  t("platform.field.license"),
                  <span className="chip" dir="ltr">
                    {o.licenseNumber}
                  </span>,
                )}
              {row(
                t("platform.tab.subscription"),
                due ? (
                  <span className={`chip ${due.tone}`}>
                    {t("platform.due", { date: due.text })}
                  </span>
                ) : (
                  <span className="chip">{t("platform.due.none")}</span>
                ),
              )}
              {row(
                t("platform.kpi.storage"),
                <span className="chip">{storageMb(o.storageBytes)}</span>,
              )}
            </div>
            <div className="panel">
              <h2>{t("platform.panel.compliance")}</h2>
              {row(
                t("platform.compliance.rls"),
                <span className="chip t-ok">{t("platform.compliance.on")}</span>,
              )}
              {row(
                t("platform.compliance.payment"),
                <span className="chip t-warn">{t("platform.compliance.notConnected")}</span>,
              )}
              <div className="docnote">{t("platform.compliance.note")}</div>
            </div>
          </div>
        </>
      )}

      {tab === "staff" && (
        <div className="panel" style={{ overflowX: "auto" }}>
          <table className="htable">
            <thead>
              <tr>
                <th>{t("platform.staff.name")}</th>
                <th>{t("platform.staff.role")}</th>
                <th>{t("platform.staff.lastLogin")}</th>
              </tr>
            </thead>
            <tbody>
              {o.staff.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}{" "}
                    {!u.isActive && (
                      <span className="chip t-neutral">{t("platform.staff.inactive")}</span>
                    )}
                  </td>
                  <td>{roleLabel(u.role)}</td>
                  <td>{u.lastLoginAt ? relTime(u.lastLoginAt) : t("platform.staff.never")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "subscription" && (
        <div className="panel">
          <h2>{t("platform.tab.subscription")}</h2>
          <div className="sub">{t("platform.subs.pill")}</div>
          {actions.includes("subscription.update") ? (
            <SubscriptionForm office={o} />
          ) : (
            <>
              {row(
                t("platform.field.status"),
                <span className={`chip ${STATUS_TONE[o.status]}`}>{statusLabel(o.status)}</span>,
              )}
              {row(
                t("platform.field.trialEndsAt"),
                <span className="chip">{fmtDate(o.trialEndsAt)}</span>,
              )}
              {row(
                t("platform.field.paidUntil"),
                <span className="chip">{fmtDate(o.paidUntil)}</span>,
              )}
            </>
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="panel">
          {o.audit.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("platform.audit.empty")}
            </div>
          ) : (
            o.audit.map((a) => (
              <div className="approve-row" key={a.id}>
                <span className="ndot" style={{ background: "var(--status-neutral-dot)" }} />
                <span className="at">
                  {actionLabel(a.action)}
                  <div className="meta" style={{ marginTop: 2 }}>
                    {a.actorName ?? t("platform.audit.system")}
                  </div>
                </span>
                <span className="chip">{fmtDate(a.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
