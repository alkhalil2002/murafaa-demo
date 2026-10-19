import { t } from "@murafaa/i18n";
import { NewOfficeWizard } from "@/components/platform/new-office-wizard";
import { platformMeData } from "@/lib/portal-data";

export default async function NewOfficePage() {
  if (!(await platformMeData())?.actions.includes("office.create"))
    return (
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>
          {t("errors.FORBIDDEN")}
        </div>
      </div>
    );
  return <NewOfficeWizard />;
}
