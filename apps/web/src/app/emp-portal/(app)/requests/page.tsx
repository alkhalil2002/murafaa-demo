import Link from "next/link";
import { employeePortalRequests } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { RequestRow } from "@/components/portal/emp-blocks";
import { EmpRequestForm } from "@/components/portal/portal-forms";
import { serverApi } from "@/lib/api";

const TABS: Array<[string, MessageKey, (s: string) => boolean]> = [
  ["all", "empPortal.requests.tab.all", () => true],
  ["pending", "empPortal.requests.tab.pending", (s) => s === "SUBMITTED" || s === "IN_REVIEW"],
  ["approved", "empPortal.requests.tab.approved", (s) => s === "APPROVED"],
  ["rejected", "empPortal.requests.tab.rejected", (s) => s === "REJECTED"],
];

/** طلباتي: a new request and the employee's own requests by status. */
export default async function EmpRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const list = (await employeePortalRequests({ client: await serverApi() })).data?.data ?? [];
  const wanted = (await searchParams).tab;
  const tab = TABS.find(([id]) => id === wanted) ?? TABS[0]!;
  const shown = list.filter((r) => tab[2](r.status));
  return (
    <>
      <div className="vhead">
        <h2>{t("empPortal.nav.requests")}</h2>
        <span className="pill">{t("empPortal.requests.pill")}</span>
      </div>
      <div className="panel">
        <h2>{t("empPortal.newRequest")}</h2>
        <EmpRequestForm />
      </div>
      <div className="ftabs">
        {TABS.map(([id, label]) => (
          <Link
            key={id}
            href={id === "all" ? "/emp-portal/requests" : `/emp-portal/requests?tab=${id}`}
            className={`ftab${tab[0] === id ? " on" : ""}`}
          >
            {t(label)}
          </Link>
        ))}
      </div>
      <div className="panel">
        {shown.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {list.length === 0 ? t("empPortal.myRequests.empty") : t("empPortal.requests.none")}
          </div>
        ) : (
          shown.map((r) => <RequestRow key={r.id} r={r} />)
        )}
      </div>
    </>
  );
}
