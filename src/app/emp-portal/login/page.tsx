import { redirect } from "next/navigation";
import { getEmpPortalSession } from "@/lib/auth/emp-portal-session";
import { EmpPortalLoginForm } from "@/components/emp-portal/emp-portal-login-form";
import { BrandMark } from "@/components/icons";
import { t } from "@/lib/i18n";

export default async function EmpPortalLoginPage() {
  const session = await getEmpPortalSession();
  if (session) redirect("/emp-portal");

  return (
    <div className="login-shell">
      <div className="lcard">
        <div className="lseal">
          <BrandMark withBase />
        </div>
        <h1>{t("app.name")}</h1>
        <div className="tag">{t("empPortal.login.tagline")}</div>
        <EmpPortalLoginForm />
      </div>
    </div>
  );
}
