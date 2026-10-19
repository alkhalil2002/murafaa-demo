import { t } from "@murafaa/i18n";
import { BrandMark } from "@/components/icons";
import { ActivateForm } from "@/components/platform/activate-form";

export default function PlatformActivatePage() {
  return (
    <div className="login-shell platform">
      <div className="lcard">
        <div className="lseal">
          <BrandMark withBase />
        </div>
        <h1>{t("app.name")}</h1>
        <span className="portalbadge platform">{t("platform.badge")}</span>
        <div className="tag">{t("platform.activate.title")}</div>
        <ActivateForm />
      </div>
    </div>
  );
}
