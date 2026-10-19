import { clientPortalListInvoices } from "@murafaa/sdk";
import { VAT_RATE } from "@murafaa/rules";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { TaxInvoicePdfButton } from "@/components/finance/tax-invoice-button";
import { serverApi } from "@/lib/api";
import { arNum } from "@/lib/portal-data";

const TONE: Record<string, string> = {
  PAID: "t-ok",
  DUE: "t-warn",
  PARTIALLY_PAID: "t-warn",
  OVERDUE: "t-danger",
  BAD_DEBT: "t-danger",
  CANCELLED: "t-neutral",
};

/**
 * الفواتير. No "pay now": there is no payment gateway yet, and a button that
 * pretends to pay would be a fabricated integration.
 */
export default async function PortalInvoicesPage() {
  const invoices = (await clientPortalListInvoices({ client: await serverApi() })).data?.data ?? [];
  const sum = (f: (i: (typeof invoices)[number]) => number) =>
    invoices.reduce((s, i) => s + f(i), 0);
  const due = sum((i) => i.remaining);
  return (
    <>
      <div className="vhead">
        <h2>{t("portal.nav.invoices")}</h2>
        <span className="pill">{t("portal.invoices.pill", { rate: arNum(VAT_RATE * 100) })}</span>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="v">{formatSar(sum((i) => i.total))}</div>
          <div className="l">{t("portal.invoices.kpiTotal")}</div>
        </div>
        <div className="kpi">
          <div className="v">{formatSar(sum((i) => i.paid))}</div>
          <div className="l">{t("portal.invoices.kpiPaid")}</div>
        </div>
        <div className={`kpi${due > 0 ? " warn" : ""}`}>
          <div className="v">{formatSar(due)}</div>
          <div className="l">{t("portal.invoices.kpiDue")}</div>
        </div>
      </div>
      <div className="panel" style={{ overflowX: "auto" }}>
        {invoices.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("portal.invoices.empty")}
          </div>
        ) : (
          <table className="htable">
            <thead>
              <tr>
                <th>{t("portal.invoices.number")}</th>
                <th>{t("portal.invoices.date")}</th>
                <th>{t("portal.invoices.case")}</th>
                <th>{t("portal.invoices.total")}</th>
                <th>{t("portal.invoices.status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td dir="ltr" style={{ textAlign: "right" }}>
                    {inv.number}
                  </td>
                  <td>{inv.issueDate}</td>
                  <td>{inv.caseTitle ?? "—"}</td>
                  <td>{formatSar(inv.total)}</td>
                  <td>
                    <span className={`chip ${TONE[inv.status] ?? "t-neutral"}`}>
                      {t(`invStatus.${inv.status}` as MessageKey)}
                    </span>
                  </td>
                  <td>
                    <TaxInvoicePdfButton
                      path={`/api/v1/portal/invoices/${inv.id}/pdf`}
                      label={t("portal.invoices.pdf")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
