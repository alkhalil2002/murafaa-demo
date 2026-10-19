import Link from "next/link";
import { platformList } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { serverApi } from "@/lib/api";
import { storageMb } from "@/lib/platform-ui";
import { arNum } from "@/lib/portal-data";

/** الاستخدام: aggregate counts per office, never what is inside them. */
export default async function PlatformUsagePage() {
  const offices = (await platformList({ client: await serverApi() })).data?.data ?? [];
  const sum = (f: (o: (typeof offices)[number]) => number) => offices.reduce((s, o) => s + f(o), 0);
  return (
    <>
      <div className="vhead">
        <h2>{t("platform.nav.usage")}</h2>
        <span className="pill">{t("platform.usage.pill")}</span>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="v">{arNum(sum((o) => o.users))}</div>
          <div className="l">{t("platform.kpi.officeUsers")}</div>
        </div>
        <div className="kpi">
          <div className="v">{arNum(sum((o) => o.cases))}</div>
          <div className="l">{t("platform.kpi.cases")}</div>
        </div>
        <div className="kpi">
          <div className="v">{arNum(sum((o) => o.documents))}</div>
          <div className="l">{t("platform.kpi.documents")}</div>
        </div>
        <div className="kpi">
          <div className="v">{storageMb(sum((o) => o.storageBytes))}</div>
          <div className="l">{t("platform.kpi.storage")}</div>
        </div>
      </div>
      <div className="panel" style={{ overflowX: "auto" }}>
        <table className="htable">
          <thead>
            <tr>
              <th>{t("platform.subs.office")}</th>
              <th>{t("platform.kpi.officeUsers")}</th>
              <th>{t("platform.kpi.cases")}</th>
              <th>{t("platform.kpi.clients")}</th>
              <th>{t("platform.kpi.documents")}</th>
              <th>{t("platform.kpi.storage")}</th>
            </tr>
          </thead>
          <tbody>
            {offices.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/platform/offices/${o.id}`} style={{ fontWeight: 600 }}>
                    {o.name}
                  </Link>
                </td>
                <td>{arNum(o.users)}</td>
                <td>{arNum(o.cases)}</td>
                <td>{arNum(o.clients)}</td>
                <td>{arNum(o.documents)}</td>
                <td>{storageMb(o.storageBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
