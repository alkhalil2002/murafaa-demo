import Link from "next/link";
import { platformList } from "@murafaa/sdk";
import { OFFICE_STATUSES } from "@murafaa/rules";
import { t } from "@murafaa/i18n";
import { serverApi } from "@/lib/api";
import { dueOf, STATUS_TONE, statusLabel } from "@/lib/platform-ui";
import { arNum, platformMeData } from "@/lib/portal-data";

/** المكاتب: KPIs, search and status filter, one card per office. */
export default async function PlatformOfficesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "" } = await searchParams;
  const offices = (await platformList({ client: await serverApi() })).data?.data ?? [];
  const canCreate = (await platformMeData())?.actions.includes("office.create") ?? false;
  const needle = q.trim();
  const shown = offices.filter(
    (o) =>
      (!status || o.status === status) &&
      (!needle || [o.name, o.ownerName ?? "", o.city ?? ""].some((v) => v.includes(needle))),
  );
  const count = (s: string) => arNum(offices.filter((o) => o.status === s).length);
  const suspended = offices.some((o) => o.status === "SUSPENDED");
  return (
    <>
      <div className="vhead">
        <h2>{t("platform.nav.offices")}</h2>
        <span className="pill">{t("platform.offices.pill", { n: arNum(offices.length) })}</span>
        {canCreate && (
          <Link
            href="/platform/offices/new"
            className="act b-primary"
            style={{ marginInlineStart: "auto" }}
          >
            {t("platform.offices.add")}
          </Link>
        )}
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="v">{count("ACTIVE")}</div>
          <div className="l">{t("platform.kpi.active")}</div>
        </div>
        <div className="kpi">
          <div className="v">{count("TRIAL")}</div>
          <div className="l">{t("platform.kpi.trial")}</div>
        </div>
        <div className={`kpi${suspended ? " warn" : ""}`}>
          <div className="v">{count("SUSPENDED")}</div>
          <div className="l">{t("platform.kpi.suspended")}</div>
        </div>
        <div className="kpi">
          <div className="v">{arNum(offices.reduce((s, o) => s + o.users, 0))}</div>
          <div className="l">{t("platform.kpi.users")}</div>
        </div>
      </div>
      <form className="filters" method="get">
        <input
          className="search"
          name="q"
          defaultValue={q}
          placeholder={t("platform.search.placeholder")}
        />
        <select name="status" defaultValue={status}>
          <option value="">{t("platform.filter.allStatuses")}</option>
          {OFFICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <button type="submit" className="mini">
          {t("platform.search.submit")}
        </button>
      </form>
      <div className="clist">
        {shown.length === 0 ? (
          <div className="empty-list">
            {offices.length === 0 ? t("platform.offices.none") : t("platform.offices.empty")}
          </div>
        ) : (
          shown.map((o) => {
            const due = dueOf(o);
            return (
              <Link
                key={o.id}
                href={`/platform/offices/${o.id}`}
                className={`ccard${o.status === "SUSPENDED" ? " done" : ""}`}
              >
                <h3>{o.name}</h3>
                <div className="chips">
                  {o.city && <span className="chip">{o.city}</span>}
                  <span className={`chip ${STATUS_TONE[o.status]}`}>{statusLabel(o.status)}</span>
                  {due && (
                    <span className={`chip ${due.tone}`}>
                      {t("platform.due", { date: due.text })}
                    </span>
                  )}
                </div>
                <div className="meta">
                  {t("platform.office.meta", {
                    owner: o.ownerName ?? "—",
                    users: arNum(o.users),
                    cases: arNum(o.cases),
                  })}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
