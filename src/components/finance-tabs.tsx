import Link from "next/link";
import { t } from "@/lib/i18n";

/** Sub-navigation for the finance module (server-rendered). */
export function FinanceTabs() {
  const tabs = [
    { href: "/finance", label: t("finance.invoices") },
    { href: "/finance/expenses", label: t("finance.expenses") },
    { href: "/finance/trust", label: t("finance.trust") },
    { href: "/finance/ledger", label: t("finance.ledger") },
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
