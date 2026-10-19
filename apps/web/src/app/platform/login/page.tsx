import { t } from "@murafaa/i18n";
import { BrandMark } from "@/components/icons";
import { PortalLoginForm } from "@/components/portal/portal-login-form";

export default function PlatformLoginPage() {
  return (
    <div className="login-shell platform">
      <div className="lcard">
        <div className="lseal">
          <BrandMark withBase />
        </div>
        <h1>{t("app.name")}</h1>
        <span className="portalbadge platform">{t("platform.badge")}</span>
        <div className="tag">{t("platform.login.tagline")}</div>
        <PortalLoginForm kind="PLATFORM" />
      </div>
    </div>
  );
}
