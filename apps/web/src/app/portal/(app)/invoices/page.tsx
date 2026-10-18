import { clientPortalListInvoices } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { serverApi } from "@/lib/api";

/** فواتيري (legacy portal invoices). */
export default async function PortalInvoicesPage() {
  const invoices = (await clientPortalListInvoices({ client: await serverApi() })).data?.data ?? [];
  return (
    <>
      <div className="vhead">
        <h2>{t("portal.invoices.title")}</h2>
      </div>
      <div className="panel">
        {invoices.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("portal.invoices.empty")}
          </div>
        ) : (
          invoices.map((inv) => (
            <div className="approve-row" key={inv.id}>
              <span className="ndot" style={{ background: "var(--bench)" }} />
              <span className="at">
                {inv.number}
                {inv.caseTitle && <span className="chip"> {inv.caseTitle}</span>}
                <span className="chip"> {inv.issueDate}</span>
                <span className="chip"> {formatSar(inv.total)}</span>
              </span>
              <span className={`chip st${inv.status === "PAID" ? "" : " done"}`}>
                {t(`invStatus.${inv.status}` as MessageKey)}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
