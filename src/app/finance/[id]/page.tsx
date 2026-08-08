import Link from "next/link";
import { redirect } from "next/navigation";
import { PaymentMethod, Role } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getInvoice } from "@/server/invoices";
import { PermissionError } from "@/lib/permissions/guard";
import { invoiceStatusLabel, payMethodLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";
import { creditNoteAction, recordPaymentAction, writeOffAction } from "../actions";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  let content: React.ReactNode;
  try {
    const inv = await getInvoice(session, id);
    const d = inv.dto;
    const canManage = session.role === Role.PARTNER || session.role === Role.ACCOUNTANT;
    const settled = d.status === "PAID" || d.status === "CANCELLED" || d.status === "BAD_DEBT";

    content = (
      <>
        <Link href="/finance" className="backbtn">
          ‹ {t("finance.invoices")}
        </Link>
        <div className="vhead">
          <h2>{inv.number}</h2>
          <span className="pill">
            {d.clientName} · {d.issueDate} · {invoiceStatusLabel(d.status)}
          </span>
        </div>

        <div className="kpis">
          <Field label={t("inv.net")} value={formatSar(d.net)} />
          <Field label={t("inv.vat")} value={formatSar(d.vat)} />
          <Field label={t("inv.total")} value={formatSar(d.total)} />
          <Field label={t("inv.paid")} value={formatSar(d.paid)} />
          <Field label={t("inv.remaining")} value={formatSar(d.remaining)} />
          {inv.basis && <Field label={t("inv.basis")} value={inv.basis} />}
        </div>

        <section className="mt-6">
          <h2 className="mb-3 font-serif text-xl text-bench">{t("inv.items")}</h2>
          <div className="panel overflow-x-auto">
            <table className="w-full text-right text-sm">
              <tbody>
                {inv.items.map((it) => (
                  <tr key={it.id} className="border-b border-parch-line last:border-0">
                    <td className="p-3">{it.description}</td>
                    <td className="p-3 text-ink-soft">{it.quantity} ×</td>
                    <td className="p-3">{formatSar(it.unitPrice)}</td>
                    <td className="p-3 font-medium">{formatSar(it.lineNet)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 font-serif text-xl text-bench">{t("inv.payments")}</h2>
          {inv.payments.length === 0 ? (
            <p className="text-sm text-ink-soft">{t("common.none")}</p>
          ) : (
            <ul className="space-y-2">
              {inv.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3 text-sm">
                  <span className="font-medium">{p.number}</span>
                  <span>{formatSar(p.amount)}</span>
                  <span className="text-ink-soft">{payMethodLabel(p.method)}</span>
                  <span className="text-ink-soft">{new Date(p.paymentDate).toISOString().slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {canManage && !settled && (
          <section className="mt-6 rounded-2xl border border-line bg-white p-5">
            <h2 className="mb-3 font-serif text-xl text-bench">{t("inv.recordPayment")}</h2>
            <form action={recordPaymentAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="invoiceId" value={inv.id} />
              <label className="flex flex-col gap-1 text-sm">
                {t("inv.amount")}
                <input name="amount" type="number" step="0.01" min="0" className="w-40 rounded-xl border border-line px-3 py-2" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("inv.method")}
                <select name="method" className="rounded-xl border border-line px-3 py-2">
                  {Object.values(PaymentMethod).map((m) => (
                    <option key={m} value={m}>{payMethodLabel(m)}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("inv.reference")}
                <input name="reference" className="w-48 rounded-xl border border-line px-3 py-2" />
              </label>
              <button type="submit" className="rounded-xl bg-bench px-4 py-2 text-sm text-white hover:bg-bench-2">
                {t("inv.pay")}
              </button>
            </form>

            {session.role === Role.PARTNER && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-parch-line pt-4">
                <form action={creditNoteAction}>
                  <input type="hidden" name="invoiceId" value={inv.id} />
                  <button type="submit" className="rounded-lg border border-advocate px-3 py-1.5 text-xs text-advocate hover:bg-advocate/5">
                    {t("inv.creditNote")}
                  </button>
                </form>
                <form action={writeOffAction}>
                  <input type="hidden" name="invoiceId" value={inv.id} />
                  <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft hover:bg-parch">
                    {t("inv.writeOff")}
                  </button>
                </form>
              </div>
            )}
          </section>
        )}
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return <AppShell>{content}</AppShell>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="v" style={{ fontSize: 20 }}>
        {value}
      </div>
      <div className="l">{label}</div>
    </div>
  );
}
