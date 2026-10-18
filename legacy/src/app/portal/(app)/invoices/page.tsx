import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/auth/portal-session";
import { listPortalInvoices } from "@/server/portal";
import { invoiceStatusLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";

function fmt(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

export default async function PortalInvoicesPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const invoices = await listPortalInvoices(session);

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
                <span className="chip"> {fmt(inv.issueDate)}</span>
                <span className="chip"> {formatSar(inv.total)}</span>
              </span>
              <span className={`chip st${inv.status === "PAID" ? "" : " done"}`}>{invoiceStatusLabel(inv.status)}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
