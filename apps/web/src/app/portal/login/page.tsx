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
        <div className="tag">{t("portal.login.tagline")}</div>
        <PortalLoginForm kind="CLIENT" />
      </div>
    </div>
  );
}
