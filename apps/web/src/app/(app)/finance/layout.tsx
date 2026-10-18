import { t } from "@murafaa/i18n";
import { FinanceTabs } from "@/components/finance/finance-tabs";

/** Every finance screen shares the title and the sub-navigation (legacy finance pages). */
export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="vhead">
        <h2>{t("finance.title")}</h2>
      </div>
      <FinanceTabs />
      {children}
    </>
  );
}
