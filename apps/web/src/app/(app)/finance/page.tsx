import Link from "next/link";
import { authCurrent, financeListInvoices, financeParties } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { CreateInvoiceForm } from "@/components/finance/finance-forms";
import { serverApi } from "@/lib/api";

/** الفواتير (legacy finance page, plus the prototype's new-invoice form). */
export default async function InvoicesPage() {
  const api = await serverApi();
  const [me, res] = await Promise.all([
    authCurrent({ client: api }),
    financeListInvoices({ client: api }),
  ]);
  const invoices = res.data?.data;
  if (!invoices) return <DeniedPanel />;
  const level = me.data?.data.modules.FINANCE;
  const canEdit = (level === "EDIT" || level === "FULL") && !me.data?.data.user.previewRole;
  const parties = canEdit ? (await financeParties({ client: api })).data?.data : undefined;
  return (
    <>
      {parties && <CreateInvoiceForm clients={parties.clients} cases={parties.cases} />}
      {invoices.length === 0 ? (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("finance.empty")}
          </div>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          {invoices.map((inv) => (
            <Link
              href={`/finance/${inv.id}`}
              className="approve-row"
              style={{ padding: "11px 22px" }}
              key={inv.id}
            >
              <span className="ndot" style={{ background: "var(--bench)" }} />
              <span className="at">
                {inv.number} — {inv.clientName}
                <span style={{ color: "var(--ink-soft)", fontSize: 15 }}> ({inv.issueDate})</span>
              </span>
              <span className="chip">
                {formatSar(inv.remaining)} {t("inv.remaining")}
              </span>
              <span className={`chip st${inv.status === "PAID" ? "" : " done"}`}>
                {t(`invStatus.${inv.status}` as MessageKey)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
