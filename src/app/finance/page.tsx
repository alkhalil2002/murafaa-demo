import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { listInvoices, type InvoiceDTO } from "@/server/invoices";
import { PermissionError } from "@/lib/permissions/guard";
import { invoiceStatusLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";

const STATUS_CLASS: Record<InvoiceDTO["status"], string> = {
  PAID: "bg-ok/15 text-ok",
  PARTIALLY_PAID: "bg-gold/20 text-warn",
  DUE: "bg-parch text-ink-soft",
  OVERDUE: "bg-advocate/15 text-advocate",
  BAD_DEBT: "bg-advocate/15 text-advocate",
  CANCELLED: "bg-line/40 text-ink-soft line-through",
};

export default async function FinancePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const invoices = await listInvoices(session);
    content =
      invoices.length === 0 ? (
        <p className="text-ink-soft">{t("finance.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("inv.number")}</th>
                <th className="p-3 font-medium">{t("inv.client")}</th>
                <th className="p-3 font-medium">{t("inv.date")}</th>
                <th className="p-3 font-medium">{t("inv.total")}</th>
                <th className="p-3 font-medium">{t("inv.paid")}</th>
                <th className="p-3 font-medium">{t("inv.remaining")}</th>
                <th className="p-3 font-medium">{t("inv.status")}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-parch-line last:border-0 hover:bg-parch">
                  <td className="p-3">
                    <Link href={`/finance/${inv.id}`} className="text-bench hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="p-3">{inv.clientName}</td>
                  <td className="p-3 text-ink-soft">{inv.issueDate}</td>
                  <td className="p-3">{formatSar(inv.total)}</td>
                  <td className="p-3 text-ink-soft">{formatSar(inv.paid)}</td>
                  <td className="p-3">{formatSar(inv.remaining)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs ${STATUS_CLASS[inv.status]}`}>
                      {invoiceStatusLabel(inv.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <h1 className="mb-4 font-serif text-3xl text-bench">{t("finance.title")}</h1>
      <FinanceTabs />
      {content}
    </AppShell>
  );
}
