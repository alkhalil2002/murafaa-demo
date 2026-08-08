import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getBillingUsage } from "@/server/billing-usage";
import { RIYADH_TZ } from "@/lib/dates";
import { t } from "@/lib/i18n";

const arNum = (n: number) => n.toLocaleString("ar-SA");

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "long" }).format(d);
}

export default async function BillingPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const usage = await getBillingUsage(session);
    const kpis: Array<[string, number]> = [
      [t("billing.kpi.seats"), usage.seats],
      [t("billing.kpi.cases"), usage.cases],
      [t("billing.kpi.clients"), usage.clients],
      [t("billing.kpi.documents"), usage.documents],
    ];
    content = (
      <>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("billing.hint")}</div>
        </div>
        <div className="kpis">
          {kpis.map(([label, value]) => (
            <div className="kpi" key={label}>
              <div className="v">{arNum(value)}</div>
              <div className="l">{label}</div>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("billing.memberSince")}: {formatDate(usage.memberSince)}
          </div>
        </div>
      </>
    );
  } catch {
    content = <DeniedPanel />;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("billing.title")}</h2>
        <span className="pill">{t("billing.pill")}</span>
      </div>
      {content}
    </AppShell>
  );
}
