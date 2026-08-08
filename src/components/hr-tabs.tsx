"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n";

/** Sub-navigation for the HR module, reproducing the prototype's `.ftabs`. */
export function HrTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/hr", label: t("hr.tab.employees") },
    { href: "/hr/payroll", label: t("hr.tab.payroll") },
    { href: "/hr/advances", label: t("hr.tab.advances") },
    { href: "/hr/leaves", label: t("hr.tab.leaves") },
    { href: "/hr/requests", label: t("hr.tab.requests") },
    { href: "/hr/saudization", label: t("hr.tab.saudization") },
  ];
  return (
    <div className="ftabs">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={`ftab${pathname === tab.href ? " on" : ""}`}>
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
