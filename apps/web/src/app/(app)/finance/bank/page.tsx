import Link from "next/link";
import { authCurrent, financeBankView } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { ClearedToggle } from "@/components/finance/finance-forms";
import { serverApi } from "@/lib/api";

const ACCOUNTS = [
  ["CURRENT", "finBank.account.current"],
  ["CASH", "finBank.account.cash"],
  ["CHEQUE", "finBank.account.cheques"],
] as const satisfies ReadonlyArray<readonly [string, MessageKey]>;

function Account({ title, inflow, outflow }: { title: string; inflow: number; outflow: number }) {
  const net = inflow - outflow;
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div className="kpis">
        <div className="kpi">
          <div className="v">{formatSar(inflow)}</div>
          <div className="l">{t("finBank.inflow")}</div>
        </div>
        <div className="kpi">
          <div className="v">{formatSar(outflow)}</div>
          <div className="l">{t("finBank.outflow")}</div>
        </div>
        <div className="kpi">
          <div className="v" style={{ color: net >= 0 ? "var(--ok)" : "var(--advocate)" }}>
            {formatSar(net)}
          </div>
          <div className="l">{t("finBank.balance")}</div>
        </div>
      </div>
    </div>
  );
}

/** البنوك والصندوق with the reconciliation ledger (legacy finance/bank). */
export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ acc?: string }>;
}) {
  const { acc } = await searchParams;
  const account = ACCOUNTS.find(([k]) => k === acc)?.[0] ?? "CURRENT";
  const api = await serverApi();
  const [me, res] = await Promise.all([
    authCurrent({ client: api }),
    financeBankView({ client: api, query: { account } }),
  ]);
  const v = res.data?.data;
  if (!v) return <DeniedPanel />;
  const level = me.data?.data.modules.FINANCE;
  const canEdit = (level === "EDIT" || level === "FULL") && !me.data?.data.user.previewRole;
  let book = 0;
  let cleared = 0;
  let uncleared = 0;
  for (const row of v.ledger) {
    book += row.amount;
    if (row.cleared) cleared += row.amount;
    else uncleared += 1;
  }
  return (
    <>
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>
          {t("finBank.hint")}
        </div>
      </div>
      <Account
        title={t("finBank.account.current")}
        inflow={v.current.inflow}
        outflow={v.current.outflow}
      />
      <Account title={t("finBank.account.cash")} inflow={v.cash.inflow} outflow={v.cash.outflow} />
      <Account
        title={t("finBank.account.cheques")}
        inflow={v.cheques.inflow}
        outflow={v.cheques.outflow}
      />
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finBank.account.trust")}</h2>
        <div className="kpis">
          <div className="kpi">
            <div className="v">{formatSar(v.trustBalance)}</div>
            <div className="l">{t("finBank.balance")}</div>
          </div>
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finBank.reconTitle")}</h2>
        <div className="chips" style={{ marginBottom: 12 }}>
          {ACCOUNTS.map(([k, label]) => (
            <Link
              key={k}
              href={`/finance/bank?acc=${k}`}
              className={`chip${account === k ? " st done" : ""}`}
            >
              {t(label)}
            </Link>
          ))}
        </div>
        <div className="kpis" style={{ marginBottom: 16 }}>
          <div className="kpi">
            <div className="v">{formatSar(book)}</div>
            <div className="l">{t("finBank.bookBalance")}</div>
          </div>
          <div className="kpi">
            <div className="v">{formatSar(cleared)}</div>
            <div className="l">{t("finBank.clearedBalance")}</div>
          </div>
          <div className="kpi">
            <div className="v">{uncleared.toLocaleString("ar-SA")}</div>
            <div className="l">{t("finBank.uncleared")}</div>
          </div>
        </div>
        {v.ledger.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("finBank.empty")}
          </div>
        ) : (
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("finBank.col.date")}</th>
                <th className="p-3 font-medium">{t("finBank.col.description")}</th>
                <th className="p-3 font-medium">{t("finBank.col.amount")}</th>
                <th className="p-3 font-medium">{t("finBank.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {v.ledger.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="border-b border-line last:border-0">
                  <td className="p-3 text-ink-soft">{row.date}</td>
                  <td className="p-3">{row.label}</td>
                  <td
                    className="p-3"
                    style={{ color: row.amount >= 0 ? "var(--ok)" : "var(--advocate)" }}
                  >
                    {formatSar(row.amount)}
                  </td>
                  <td className="p-3">
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {row.cleared && (
                        <span className="chip" style={{ color: "var(--ok)" }}>
                          {t("finBank.cleared")}
                        </span>
                      )}
                      {canEdit && (
                        <ClearedToggle kind={row.kind} id={row.id} cleared={row.cleared} />
                      )}
                    </div>
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
