import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { listInvoices } from "@/server/invoices";
import { PermissionError } from "@/lib/permissions/guard";
import { invoiceStatusLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";

export default async function FinancePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const invoices = await listInvoices(session);
    content =
      invoices.length === 0 ? (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("finance.empty")}
          </div>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0 }}>
          {invoices.map((inv) => (
            <Link href={`/finance/${inv.id}`} className="approve-row" style={{ padding: "11px 22px" }} key={inv.id}>
              <span className="ndot" style={{ background: "var(--bench)" }} />
              <span className="at">
                {inv.number} — {inv.clientName}
                <span style={{ color: "var(--ink-soft)", fontSize: 15 }}> ({inv.issueDate})</span>
              </span>
              <span className="chip">{formatSar(inv.remaining)} {t("inv.remaining")}</span>
              <span className={`chip st${inv.status === "PAID" ? "" : " done"}`}>
                {invoiceStatusLabel(inv.status)}
              </span>
            </Link>
          ))}
        </div>
      );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("finance.title")}</h2>
      </div>
      <FinanceTabs />
      {content}
    </AppShell>
  );
}
