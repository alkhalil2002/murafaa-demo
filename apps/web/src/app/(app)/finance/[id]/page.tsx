import Link from "next/link";
import { authCurrent, financeInvoiceDetail } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { UnderConstruction } from "@/components/under-construction";
import { CancelControls, PaymentForm } from "@/components/finance/finance-forms";
import { serverApi } from "@/lib/api";
import { TaxInvoicePdfButton } from "@/components/finance/tax-invoice-button";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="v" style={{ fontSize: 25 }}>
        {value}
      </div>
      <div className="l">{label}</div>
    </div>
  );
}

/** One invoice: amounts, items, receipts, and the actions its status allows (legacy invoice page). */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Finance tabs not rebuilt yet (/finance/dashboard, …) share this segment.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return <UnderConstruction />;
  const api = await serverApi();
  const [me, res] = await Promise.all([
    authCurrent({ client: api }),
    financeInvoiceDetail({ client: api, path: { id } }),
  ]);
  const d = res.data?.data;
  if (!d) return <DeniedPanel />;
  const level = me.data?.data.modules.FINANCE;
  const preview = Boolean(me.data?.data.user.previewRole);
  const canEdit = (level === "EDIT" || level === "FULL") && !preview;
  const canCancel = level === "FULL" && !preview;
  const settled = d.status === "PAID" || d.status === "CANCELLED" || d.status === "BAD_DEBT";
  return (
    <>
      <Link href="/finance" className="backbtn">
        ‹ {t("finance.invoices")}
      </Link>
      <div className="vhead">
        <h2>{d.number}</h2>
        <span className="pill">
          {d.clientName} · {d.issueDate} · {t(`invStatus.${d.status}` as MessageKey)}
        </span>
        <div style={{ marginInlineStart: "auto" }}>
          <TaxInvoicePdfButton invoiceId={d.id} />
        </div>
      </div>
      <div className="kpis">
        <Field label={t("inv.net")} value={formatSar(d.net)} />
        <Field label={t("inv.vat")} value={formatSar(d.vat)} />
        <Field label={t("inv.total")} value={formatSar(d.total)} />
        <Field label={t("inv.paid")} value={formatSar(d.paid)} />
        <Field label={t("inv.remaining")} value={formatSar(d.remaining)} />
        {d.basis && <Field label={t("inv.basis")} value={d.basis} />}
      </div>
      {d.caseId && (
        <div className="chips" style={{ marginBottom: 12 }}>
          <Link href={`/cases/${d.caseId}?tab=finance`} className="chip">
            ⚖ {d.caseTitle}
          </Link>
        </div>
      )}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("inv.items")}</h2>
        <table className="w-full text-right text-sm">
          <tbody>
            {d.items.map((it) => (
              <tr key={it.id} className="border-b border-line last:border-0">
                <td className="p-3">{it.description}</td>
                <td className="p-3 text-ink-soft">{it.quantity.toLocaleString("ar-SA")} ×</td>
                <td className="p-3">{formatSar(it.unitPrice)}</td>
                <td className="p-3 font-medium">{formatSar(it.lineNet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("inv.payments")}</h2>
        {d.payments.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("common.none")}
          </div>
        ) : (
          d.payments.map((x) => (
            <div className="approve-row" key={x.id}>
              <span className="ndot" style={{ background: "var(--ok)" }} />
              <span className="at">
                {x.number} · {formatSar(x.amount)}
                <span className="chip"> {t(`payMethod.${x.method}` as MessageKey)}</span>
                {x.reference && <span className="chip"> {x.reference}</span>}
                {!x.isApproved && (
                  <span
                    className="chip"
                    style={{ color: "var(--amber-600)", borderColor: "var(--amber-400)" }}
                  >
                    {" "}
                    {t("inv.pendingApproval")}
                  </span>
                )}
              </span>
              <span className="chip">{x.date}</span>
            </div>
          ))
        )}
        {d.creditNote && (
          <div className="docnote" style={{ marginTop: 10 }}>
            {t("inv.creditNoteInfo", { number: d.creditNote.number, date: d.creditNote.date })}
            {d.creditNote.reason ? ` — ${d.creditNote.reason}` : ""}
          </div>
        )}
      </div>
      {canEdit && !settled && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("inv.recordPayment")}</h2>
          <PaymentForm invoiceId={d.id} />
          {canCancel && <CancelControls invoiceId={d.id} />}
        </div>
      )}
    </>
  );
}
