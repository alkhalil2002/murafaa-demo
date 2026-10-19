import { platformAudit } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { serverApi } from "@/lib/api";
import { fmtDate } from "@/lib/dates-ui";
import { actionLabel } from "@/lib/platform-ui";

const DOT: Record<string, string> = {
  "platform.office.create": "var(--status-success-dot)",
  "platform.office.reactivate": "var(--status-success-dot)",
  "platform.office.suspend": "var(--status-danger-dot)",
  "platform.login.failed": "var(--status-warning-dot)",
};

/** سجل التدقيق: every platform action, newest first (append-only). */
export default async function PlatformAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim();
  const rows = (await platformAudit({ client: await serverApi() })).data?.data ?? [];
  const shown = rows.filter(
    (a) =>
      !q ||
      [actionLabel(a.action), a.actorName ?? "", a.officeName ?? ""].some((v) => v.includes(q)),
  );
  return (
    <>
      <div className="vhead">
        <h2>{t("platform.nav.audit")}</h2>
        <span className="pill">{t("platform.audit.pill")}</span>
      </div>
      <form className="filters" method="get">
        <input
          className="search"
          name="q"
          defaultValue={q}
          placeholder={t("platform.search.placeholder")}
        />
        <button type="submit" className="mini">
          {t("platform.search.submit")}
        </button>
      </form>
      <div className="panel">
        {shown.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("platform.audit.empty")}
          </div>
        ) : (
          shown.map((a) => (
            <div className="approve-row" key={a.id}>
              <span
                className="ndot"
                style={{ background: DOT[a.action] ?? "var(--status-neutral-dot)" }}
              />
              <span className="at">
                {actionLabel(a.action)}
                {a.officeName && (
                  <span className="chip" style={{ marginInlineStart: 8 }}>
                    {a.officeName}
                  </span>
                )}
                <div className="meta" style={{ marginTop: 2 }}>
                  {a.actorName ?? t("platform.audit.system")}
                </div>
              </span>
              <span className="chip">{fmtDate(a.createdAt)}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
