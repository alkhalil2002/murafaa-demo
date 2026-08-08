"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n";

/** Sub-navigation for the finance module, reproducing the prototype's `.ftabs`. */
export function FinanceTabs() {
  const pathname = usePathname();
  const tabs = [
    { href: "/finance", label: t("finance.invoices") },
    { href: "/finance/expenses", label: t("finance.expenses") },
    { href: "/finance/trust", label: t("finance.trust") },
    { href: "/finance/ledger", label: t("finance.ledger") },
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
