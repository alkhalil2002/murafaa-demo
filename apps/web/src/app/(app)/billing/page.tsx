import { t } from "@murafaa/i18n";
import { billingUsage } from "@murafaa/sdk";
import { PermsDenied } from "@/components/perms/perms-page";
import { serverApi } from "@/lib/api";

const arNum = (n: number) => n.toLocaleString("ar-SA");
const longDate = (iso: string) =>
  new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "long" }).format(
    new Date(iso),
  );

export default async function BillingPage() {
  const usage = (await billingUsage({ client: await serverApi() })).data?.data;
  return (
    <>
      <div className="vhead">
        <h2>{t("billing.title")}</h2>
        <span className="pill">{t("billing.pill")}</span>
      </div>
      {!usage ? (
        <PermsDenied />
      ) : (
        <>
          <div className="panel">
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("billing.hint")}
            </div>
          </div>
          <div className="kpis">
            {(
              [
                ["billing.kpi.seats", usage.seats],
                ["billing.kpi.cases", usage.cases],
                ["billing.kpi.clients", usage.clients],
                ["billing.kpi.documents", usage.documents],
              ] as const
            ).map(([label, value]) => (
              <div className="kpi" key={label}>
                <div className="v">{arNum(value)}</div>
                <div className="l">{t(label)}</div>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("billing.memberSince")}: {longDate(usage.memberSince)}
            </div>
          </div>
        </>
      )}
    </>
  );
}
