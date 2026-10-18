import { t } from "@murafaa/i18n";
import { HrTabs } from "@/components/hr/hr-tabs";

/** Title and sub-navigation of the HR list screens (legacy). */
export function HrHeader() {
  return (
    <>
      <div className="vhead">
        <h2>{t("hr.title")}</h2>
      </div>
      <HrTabs />
    </>
  );
}
