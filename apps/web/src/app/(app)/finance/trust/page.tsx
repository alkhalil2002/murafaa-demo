import Link from "next/link";
import { authCurrent, financeParties, financeTrustAccounts } from "@murafaa/sdk";
import { formatSar, t } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { TrustMoveForm } from "@/components/finance/finance-forms";
import { serverApi } from "@/lib/api";

/** الأمانات: client trust balances, kept apart from office revenue (legacy trust page). */
export default async function TrustPage() {
  const api = await serverApi();
  const [me, res] = await Promise.all([
    authCurrent({ client: api }),
    financeTrustAccounts({ client: api }),
  ]);
  const data = res.data?.data;
  if (!data) return <DeniedPanel />;
  const level = me.data?.data.modules.FINANCE;
  const canEdit = (level === "EDIT" || level === "FULL") && !me.data?.data.user.previewRole;
  const parties = canEdit ? (await financeParties({ client: api })).data?.data : undefined;
  return (
    <>
      <div className="panel" style={{ borderColor: "var(--gold)" }}>
        <span className="sub">{t("trust.totalBalance")}: </span>
        <b style={{ color: "var(--bench)" }}>{formatSar(data.total)}</b>
        <span className="sub" style={{ marginInlineStart: 8 }}>
          — {t("trust.segregationNote")}
        </span>
      </div>
      {parties && <TrustMoveForm clients={parties.clients} />}
      {data.accounts.length === 0 ? (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("finance.empty")}
          </div>
        </div>
      ) : (
        <div className="panel">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("trust.client")}</th>
                <th className="p-3 font-medium">{t("trust.balance")}</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a) => (
                <tr key={a.clientId} className="border-b border-line last:border-0">
                  <td className="p-3 font-medium">{a.clientName}</td>
                  <td className="p-3">{formatSar(a.balance)}</td>
                  <td className="p-3">
                    <Link href={`/finance/trust/${a.clientId}`} className="tinybtn">
                      {t("trust.viewLedger")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
