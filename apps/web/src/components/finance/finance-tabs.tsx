"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, type MessageKey } from "@murafaa/i18n";

const TABS: Array<[string, MessageKey]> = [
  ["/finance/dashboard", "finance.dashboard"],
  ["/finance", "finance.invoices"],
  ["/finance/expenses", "finance.expenses"],
  ["/finance/trust", "finance.trust"],
  ["/finance/ledger", "finance.ledger"],
  ["/finance/coa", "finance.coa"],
  ["/finance/journal", "finance.journal"],
  ["/finance/profitability", "finance.profit"],
  ["/finance/bank", "finance.bank"],
  ["/finance/statements", "finance.statements"],
  ["/finance/governance", "finance.governance"],
];

/** Finance sub-navigation (prototype `.ftabs`, legacy finance-tabs). */
export function FinanceTabs() {
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
