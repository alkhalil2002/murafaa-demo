import { redirect } from "next/navigation";
import { t } from "@murafaa/i18n";
import { PortalShell } from "@/components/portal/portal-shell";
import { employeePortalMeData } from "@/lib/portal-data";

/**
 * بوابة الموظف shell. Performance reviews and HR documents (payslips,
 * contract, GOSI certificate) have no data behind them yet, so they have no
 * pages here (owner decision 2026-10-19).
 */
export default async function EmpPortalLayout({ children }: { children: React.ReactNode }) {
  const me = await employeePortalMeData();
  if (!me) redirect("/emp-portal/login");
  return (
    <PortalShell
      kind="EMPLOYEE"
      officeName={me.officeName}
      badge={t("empPortal.login.tagline")}
      userName={me.name}
      items={[
        { href: "/emp-portal", label: t("empPortal.nav.home"), icon: "today" },
        { href: "/emp-portal/requests", label: t("empPortal.nav.requests"), icon: "tasks" },
        { href: "/emp-portal/leaves", label: t("empPortal.nav.leaves"), icon: "leaves" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
