import { t } from "@murafaa/i18n";
import { BrandMark } from "@/components/icons";
import { PortalLoginForm } from "@/components/portal/portal-login-form";

export default function PortalLoginPage() {
  return (
    <div className="login-shell">
      <div className="lcard">
        <div className="lseal">
          <BrandMark withBase />
        </div>
        <h1>{t("app.name")}</h1>
        <span className="portalbadge">{t("empPortal.login.tagline")}</span>
        <div className="tag">{t("app.tagline")}</div>
        <PortalLoginForm kind="EMPLOYEE" />
      </div>
    </div>
  );
}
