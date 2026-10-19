import Link from "next/link";
import { authCurrent, financeTrustLedger } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { TrustMoveForm } from "@/components/finance/finance-forms";
import { serverApi } from "@/lib/api";

/** One client's trust ledger with the running balance (legacy trust ledger page). */
export default async function TrustLedgerPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const api = await serverApi();
  const [me, res] = await Promise.all([
    authCurrent({ client: api }),
    financeTrustLedger({ client: api, path: { clientId } }),
  ]);
  const l = res.data?.data;
  if (!l) return <DeniedPanel />;
  const level = me.data?.data.modules.FINANCE;
  const canEdit = (level === "EDIT" || level === "FULL") && !me.data?.data.user.previewRole;
  return (
    <>
      <Link href="/finance/trust" className="backbtn">
        {t("trust.back")}
      </Link>
      {canEdit && <TrustMoveForm clientId={clientId} />}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>
          {t("trust.ledgerTitle")} — {l.clientName}
        </h2>
        {l.movements.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("trust.noTransactions")}
          </div>
        ) : (
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("trust.date")}</th>
                <th className="p-3 font-medium">{t("trust.type")}</th>
                <th className="p-3 font-medium">{t("trust.amount")}</th>
                <th className="p-3 font-medium">{t("trust.runningBalance")}</th>
                <th className="p-3 font-medium">{t("trust.note")}</th>
              </tr>
            </thead>
            <tbody>
              {l.movements.map((m) => {
                const deposit = m.type === "DEPOSIT";
                const color = deposit ? "var(--ok)" : "var(--amber-600)";
                return (
                  <tr key={m.id} className="border-b border-line last:border-0">
                    <td className="p-3 text-ink-soft">{m.date}</td>
                    <td className="p-3">
                      <span className="chip" style={{ color }}>
                        {t(`trust.type.${m.type}` as MessageKey)}
                      </span>
                    </td>
                    <td className="p-3" style={{ color }} dir="ltr">
                      {deposit ? "+" : "−"}
                      {formatSar(m.amount)}
                    </td>
                    <td className="p-3 font-medium">{formatSar(m.runningBalance)}</td>
                    <td className="p-3 text-ink-soft">{m.note ?? "—"}</td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, background: "var(--parch)" }}>
                <td className="p-3" colSpan={3}>
                  {t("trust.balance")}
                </td>
                <td className="p-3">{formatSar(l.balance)}</td>
                <td className="p-3" />
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
