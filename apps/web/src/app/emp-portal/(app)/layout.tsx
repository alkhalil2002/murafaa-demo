import Link from "next/link";
import { redirect } from "next/navigation";
import { employeePortalMe } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { PortalLogoutButton } from "@/components/portal/portal-forms";
import { serverApi } from "@/lib/api";

/** بوابة الموظف shell (legacy emp-portal layout). */
export default async function EmpPortalLayout({ children }: { children: React.ReactNode }) {
  const me = (await employeePortalMe({ client: await serverApi() })).data?.data;
  if (!me) redirect("/emp-portal/login");
  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "var(--parch)" }}>
      <div className="topbar" style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 0" }}>
        <Link href="/emp-portal" className="pill">
          {me.officeName} — {t("empPortal.login.tagline")}
        </Link>
        <span className="chip" style={{ marginInlineStart: "auto" }}>
          {me.name}
        </span>
        <PortalLogoutButton kind="EMPLOYEE" />
      </div>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>{children}</main>
    </div>
  );
}
