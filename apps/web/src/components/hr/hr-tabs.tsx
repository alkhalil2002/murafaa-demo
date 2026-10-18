"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, type MessageKey } from "@murafaa/i18n";

const TABS: Array<[string, MessageKey]> = [
  ["/hr", "hr.tab.employees"],
  ["/hr/payroll", "hr.tab.payroll"],
  ["/hr/advances", "hr.tab.advances"],
  ["/hr/leaves", "hr.tab.leaves"],
  ["/hr/attendance", "hr.tab.attendance"],
  ["/hr/recruitment", "hr.tab.recruitment"],
  ["/hr/performance", "hr.tab.performance"],
  ["/hr/integrations", "hr.tab.integrations"],
  ["/hr/org", "hr.tab.org"],
  ["/hr/requests", "hr.tab.requests"],
  ["/hr/saudization", "hr.tab.saudization"],
];

/** HR sub-navigation (prototype `.ftabs`, legacy hr-tabs). */
export function HrTabs() {
  const pathname = usePathname();
  return (
    <div className="ftabs">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} className={`ftab${pathname === href ? " on" : ""}`}>
          {t(label)}
        </Link>
      ))}
    </div>
  );
}
