import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { BrandMark } from "@/components/icons";
import { getPlatformSession } from "@/lib/auth/platform-session";
import { t } from "@/lib/i18n";

export default async function AdminLoginPage() {
  if (await getPlatformSession()) redirect("/admin");
  return (
    <div className="login-shell">
      <div className="lcard">
        <div className="lseal">
          <BrandMark withBase />
        </div>
        <h1>{t("admin.title")}</h1>
        <div className="tag">{t("admin.login.tagline")}</div>
        <AdminLoginForm />
      </div>
    </div>
  );
}
