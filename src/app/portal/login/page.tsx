import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/auth/portal-session";
import { PortalLoginForm } from "@/components/portal/portal-login-form";
import { BrandMark } from "@/components/icons";
import { t } from "@/lib/i18n";

export default async function PortalLoginPage() {
  const session = await getPortalSession();
  if (session) redirect("/portal");

  return (
    <div className="login-shell">
      <div className="lcard">
        <div className="lseal">
          <BrandMark withBase />
        </div>
        <h1>{t("app.name")}</h1>
        <div className="tag">{t("portal.login.tagline")}</div>
        <PortalLoginForm />
      </div>
    </div>
  );
}
