import Link from "next/link";
import { t } from "@/lib/i18n";

/** Sub-navigation for the HR module (server-rendered), mirroring FinanceTabs. */
export function HrTabs() {
  const tabs = [
    { href: "/hr", label: t("hr.tab.employees") },
    { href: "/hr/payroll", label: t("hr.tab.payroll") },
    { href: "/hr/advances", label: t("hr.tab.advances") },
    { href: "/hr/leaves", label: t("hr.tab.leaves") },
    { href: "/hr/requests", label: t("hr.tab.requests") },
    { href: "/hr/saudization", label: t("hr.tab.saudization") },
  ];
  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-line pb-3">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className="rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:bg-white hover:text-bench"
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
